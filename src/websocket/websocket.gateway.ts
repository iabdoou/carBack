import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { corsOrigins } from '../config/env.validation';

type ClientInfo = { userId: string; role: string };

@WebSocketGateway({
  cors: {
    // Resolved per request: decorators run before ConfigModule loads .env
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, !origin || corsOrigins().includes(origin)),
    credentials: true,
  },
  namespace: '/',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedClients = new Map<string, ClientInfo>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      this.connectedClients.set(client.id, { userId: payload.sub, role: payload.role });

      // Auto-join the rooms the services emit to
      if (payload.role === 'ADMIN') {
        client.join('admin');
      } else if (payload.role === 'SUPPLIER') {
        client.join(`supplier:${payload.sub}`);
      } else if (payload.role === 'BUYER') {
        client.join(`buyer:${payload.sub}`);
      }

      client.emit('connected', { userId: payload.sub, role: payload.role });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    const clientInfo = this.connectedClients.get(client.id);
    const room = typeof data?.room === 'string' ? data.room : '';
    if (!clientInfo || !(await this.canJoin(clientInfo, room))) {
      client.emit('subscribe_error', { room });
      return;
    }
    client.join(room);
    client.emit('subscribed', { room });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (typeof data?.room !== 'string') return;
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

  private async canJoin({ userId, role }: ClientInfo, room: string) {
    const [type, id] = room.split(':');
    if (role === 'ADMIN') return true;
    if (type === 'supplier') return role === 'SUPPLIER' && id === userId;
    if (type === 'buyer') return role === 'BUYER' && id === userId;
    if (type === 'order' && role === 'BUYER' && id) {
      try {
        const order = await this.prisma.order.findUnique({ where: { id }, select: { buyerId: true } });
        return order?.buyerId === userId;
      } catch (error) {
        this.logger.warn(`Order room check failed: ${error instanceof Error ? error.message : error}`);
        return false;
      }
    }
    return false;
  }
}
