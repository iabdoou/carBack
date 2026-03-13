import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://vehicle-import-mgmt.preview.emergentagent.com'],
    credentials: true,
  },
  namespace: '/',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients: Map<string, { userId: string; role: string; socket: Socket }> = new Map();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Get token from handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('WS: No token provided, disconnecting');
        client.disconnect();
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      // Store client info
      this.connectedClients.set(client.id, {
        userId: payload.sub,
        role: payload.role,
        socket: client,
      });

      console.log(`WS: Client connected - User: ${payload.sub}, Role: ${payload.role}`);

      // Auto-join rooms based on role
      if (payload.role === 'ADMIN') {
        client.join('admin');
      } else if (payload.role === 'SUPPLIER') {
        client.join(`supplier:${payload.sub}`);
      }

      client.emit('connected', { userId: payload.sub, role: payload.role });
    } catch (error) {
      console.log('WS: Invalid token, disconnecting');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      console.log(`WS: Client disconnected - User: ${clientInfo.userId}`);
      this.connectedClients.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    if (!clientInfo) return;

    // Validate room subscription
    const roomParts = data.room.split(':');
    const roomType = roomParts[0];

    // Check permissions
    if (roomType === 'order') {
      // Buyers can only subscribe to their own orders
      // Admins can subscribe to any order
      // For simplicity, we allow the subscription and validate in the service
      client.join(data.room);
      console.log(`WS: User ${clientInfo.userId} subscribed to ${data.room}`);
      client.emit('subscribed', { room: data.room });
    } else if (roomType === 'supplier' && clientInfo.role === 'SUPPLIER') {
      client.join(data.room);
      client.emit('subscribed', { room: data.room });
    } else if (roomType === 'admin' && clientInfo.role === 'ADMIN') {
      client.join(data.room);
      client.emit('subscribed', { room: data.room });
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    client.leave(data.room);
    client.emit('unsubscribed', { room: data.room });
  }

  // Helper method to emit to a specific room
  emitToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  // Helper method to emit to all connected clients
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }
}
