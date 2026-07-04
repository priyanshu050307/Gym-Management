import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import logger from './logger.js';

let io: SocketServer;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173'];

  io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId as string | undefined;
    const ownerId = socket.handshake.auth?.ownerId as string | undefined;

    logger.info('Socket: Client connected', { socketId: socket.id, userId, ownerId });

    // Join tenant-specific room for owner-scoped events
    if (ownerId) {
      socket.join(`owner:${ownerId}`);
    }
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', (reason) => {
      logger.info('Socket: Client disconnected', { socketId: socket.id, reason });
    });
  });

  logger.info('Socket.io server initialized');
  return io;
};

export const getIO = (): SocketServer => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket first.');
  return io;
};

// ──────────────────────────────────────────────
// Event emitters — called from controllers
// ──────────────────────────────────────────────

export const emitToOwner = (ownerId: string, event: string, data: unknown) => {
  try {
    getIO().to(`owner:${ownerId}`).emit(event, data);
  } catch {
    // Socket not yet initialized (unit tests etc.), ignore
  }
};

export const emitToUser = (userId: string, event: string, data: unknown) => {
  try {
    getIO().to(`user:${userId}`).emit(event, data);
  } catch {
    // Socket not yet initialized, ignore
  }
};

// Specific typed emitters
export const emitNewCheckIn = (ownerId: string, data: { memberName: string; branchName: string; timestamp: string }) => {
  emitToOwner(ownerId, 'checkin:new', data);
};

export const emitPaymentReceived = (ownerId: string, data: { memberName: string; amount: number; planName: string }) => {
  emitToOwner(ownerId, 'payment:received', data);
};

export const emitMemberRegistered = (ownerId: string, data: { memberName: string; branchName: string }) => {
  emitToOwner(ownerId, 'member:registered', data);
};

export const emitNotificationToUser = (userId: string, data: { title: string; message: string; type: string }) => {
  emitToUser(userId, 'notification:new', data);
};
