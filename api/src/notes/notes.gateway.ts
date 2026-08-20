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
import { NotesService } from './notes.service';

@WebSocketGateway({
  cors: { origin: '*' }, // fine for local dev, tighten this before deploying
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private notesService: NotesService,
  ) {}

  // Runs when any client connects - verify their JWT before letting them do anything
  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token; 
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub; // stash the user id on the socket for later
    } catch (err) {
      client.disconnect(); // bad/missing token gets kicked out immediately
    }
  }

  handleDisconnect(client: Socket) {
    // nothing needed here yet, but Nest requires the method if we implement OnGatewayDisconnect
  }

  // Client asks to join a specific note's "room"
  @SubscribeMessage('join_note')
  async handleJoinNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    try {
      const userId = client.data.userId;

      // findOne already checks whether this user owns
      // or collaborates on the note
      await this.notesService.findOne(userId, data.noteId);

      await client.join(data.noteId);

      client.emit('joined_note', {
        noteId: data.noteId,
      });
    } catch {
      client.emit('join_note_error', {
        noteId: data.noteId,
        message: 'You do not have access to this note',
      });
    }
  }

  // Client sends an edit - broadcast it to everyone else in the same room
  @SubscribeMessage('edit_note')
  handleEditNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string; content: string },
  ) {
    if (!client.rooms.has(data.noteId)) {
      client.emit('edit_note_error', {
        noteId: data.noteId,
        message: 'You are not authorized to edit this note',
      });

      return;
    }

    client.to(data.noteId).emit('note_updated', {
      content: data.content,
      userId: client.data.userId,
    });
  }
}