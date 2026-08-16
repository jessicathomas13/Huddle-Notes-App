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

@WebSocketGateway({
  cors: { origin: '*' }, // fine for local dev, tighten this before deploying
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private jwtService: JwtService) {}

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
  handleJoinNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    client.join(data.noteId); // socket.io rooms - scopes broadcasts to just this note
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
    // .to() broadcasts to everyone in the room EXCEPT the sender
  }

  @SubscribeMessage('leave_note')
  handleLeaveNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    client.leave(data.noteId);
  }
}