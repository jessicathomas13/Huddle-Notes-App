import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';


// Tracks who's currently in each note's room: noteId -> Map<socketId, userInfo>
// would need Redis for multi-instance deploys
const presenceByNote = new Map<string, Map<string, { userId: string; name: string; avatarUrl?: string }>>();

@WebSocketGateway({
  cors: { origin: '*' }, // fine for local dev, tighten this before deploying
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Runs when any client connects - verify their JWT before letting them do anything
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token; 
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub; // stash the user id on the socket for later

      // fetch name/avatar once on connect so we don't hit the DB on every join/edit
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { name: true, avatarUrl: true },
      });
      client.data.name = user?.name ?? 'Unknown';
      client.data.avatarUrl = user?.avatarUrl;
    } catch (err) {
      client.disconnect(); // bad/missing token gets kicked out immediately
    }
  }

  handleDisconnect(client: Socket) {
    // clean up presence if they were in a room when they disconnected (e.g. closed the tab)
    const noteId = client.data.currentNoteId;
    if (noteId) {
      this.removeFromPresence(noteId, client.id);
    }
  }

  // Client asks to join a specific note's "room"
  @SubscribeMessage('join_note')
  handleJoinNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    client.join(data.noteId);
    client.data.currentNoteId = data.noteId; // remember for cleanup on disconnect

    if (!presenceByNote.has(data.noteId)) {
      presenceByNote.set(data.noteId, new Map());
    }
    presenceByNote.get(data.noteId)!.set(client.id, {
      userId: client.data.userId,
      name: client.data.name,
      avatarUrl: client.data.avatarUrl,
    });

    this.broadcastPresence(data.noteId);
  }

  // Client sends an edit - broadcast it to everyone else in the same room
  @SubscribeMessage('edit_note')
  handleEditNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string; content: string },
  ) {
    client.to(data.noteId).emit('note_updated', {
      content: data.content,
      userId: client.data.userId,
    });
  }

  @SubscribeMessage('leave_note')
  handleLeaveNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    client.leave(data.noteId);
    this.removeFromPresence(data.noteId, client.id);
  }

  // Removes a socket from a note's presence map and notifies everyone else still in the room
  private removeFromPresence(noteId: string, socketId: string) {
    const room = presenceByNote.get(noteId);
    if (!room) return;
    room.delete(socketId);
    if (room.size === 0) {
      presenceByNote.delete(noteId); // clean up empty rooms
    }
    this.broadcastPresence(noteId);
  }

  // Sends the current list of who's in the room to everyone in that room
  private broadcastPresence(noteId: string) {
    const room = presenceByNote.get(noteId);
    const users = room ? Array.from(room.values()) : [];
    this.server.to(noteId).emit('presence_update', users);
  }
}