/**
 * sockets/index.js
 * Configures Socket.IO server, handshake authentication middleware,
 * presence tracking, and integration with the decoupled eventBus.
 */

import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { eventBus } from '../events/eventBus.js';
import {
  registerStaffSocket,
  sendInitialPresence,
  unregisterStaffSocket,
} from '../services/presence.service.js';
import { registerChatHandlers } from './chat.handler.js';

/**
 * Initialize Socket.IO on top of the HTTP server.
 * @param {import('node:http').Server} httpServer
 * @returns {Server}
 */
export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Handshake Authentication Middleware ───────────────────────────────────
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth || {};
    const token = auth.token;
    const visitorToken = auth.visitorToken;

    if (token) {
      // 1. Staff Authentication
      try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        });

        if (!user || !user.isActive) {
          return next(new Error('ACCOUNT_INACTIVE'));
        }

        socket.user = user;
        socket.isStaff = true;
        return next();
      } catch (err) {
        return next(new Error('UNAUTHORIZED'));
      }
    }

    if (visitorToken) {
      // 2. Customer Authentication
      try {
        const customer = await prisma.customer.findUnique({
          where: { visitorToken },
        });

        if (!customer) {
          return next(new Error('CUSTOMER_NOT_FOUND'));
        }

        socket.customer = customer;
        socket.isStaff = false;
        return next();
      } catch (err) {
        return next(new Error('UNAUTHORIZED'));
      }
    }

    return next(new Error('UNAUTHORIZED'));
  });

  // ── Connection Handling ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    if (socket.isStaff) {
      socket.join('agents');
      socket.join(`user:${socket.user.id}`);
      registerStaffSocket(io, socket.user.id, socket.id);

      socket.on('disconnect', () => {
        unregisterStaffSocket(io, socket.user.id, socket.id);
      });
    } else {
      socket.join('customers');
      socket.join(`customer:${socket.customer.id}`);
      sendInitialPresence(socket);
    }

    registerChatHandlers(io, socket);
  });

  // ── Decoupled EventBus Listeners ──────────────────────────────────────────

  // Emitted by REST ticket actions (claim, release, assign, update) and autoClose job
  eventBus.on('ticket:updated', ({ ticket, customerId }) => {
    io.to('agents').emit('ticket:updated', ticket);
    if (customerId) {
      io.to(`customer:${customerId}`).emit('ticket:updated', ticket);
    }
  });

  // Emitted when a new ticket is created
  eventBus.on('ticket:created', ({ ticket }) => {
    io.to('agents').emit('ticket:created', ticket);
  });

  // Disconnect active sockets when a user is deactivated by admin
  eventBus.on('user:deactivated', (userId) => {
    io.in(`user:${userId}`).disconnectSockets(true);
  });

  return io;
}
