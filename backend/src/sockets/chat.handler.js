/**
 * sockets/chat.handler.js
 * Registers Socket.IO event handlers for message:send and sync:request.
 */

import { z } from 'zod';
import * as chatService from '../services/chat.service.js';
import * as notificationService from '../services/notification.service.js';

const customerMessageSchema = z.object({
  body: z.string().trim().min(1, 'Isi pesan tidak boleh kosong').max(2000, 'Isi pesan maksimal 2000 karakter'),
  clientMessageId: z.string().uuid('clientMessageId harus berformat UUID'),
});

const staffMessageSchema = z.object({
  ticketId: z.coerce.number().int().positive('ticketId harus bilangan bulat positif'),
  body: z.string().trim().min(1, 'Isi pesan tidak boleh kosong').max(2000, 'Isi pesan maksimal 2000 karakter'),
  clientMessageId: z.string().uuid('clientMessageId harus berformat UUID'),
});

const customerSyncSchema = z.object({
  lastMessageId: z.coerce.number().int().positive().optional(),
});

const staffSyncSchema = z.object({
  tickets: z
    .array(
      z.object({
        ticketId: z.coerce.number().int().positive(),
        lastMessageId: z.coerce.number().int().positive().optional(),
      })
    )
    .optional(),
});

/**
 * Register chat event listeners for a socket.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerChatHandlers(io, socket) {
  // Rate limiting tracker per customer socket (20 messages per minute)
  const messageTimestamps = [];

  // ── Event: message:send ───────────────────────────────────────────────────
  socket.on('message:send', async (payload, ack) => {
    const sendAck = typeof ack === 'function' ? ack : () => {};

    try {
      if (socket.isStaff) {
        // Staff sending message
        const parsed = staffMessageSchema.safeParse(payload);
        if (!parsed.success) {
          return sendAck({
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Input pesan tidak valid.',
              details: parsed.error.flatten().fieldErrors,
            },
          });
        }

        const { ticketId, body, clientMessageId } = parsed.data;
        const result = await chatService.sendStaffMessage({
          ticketId,
          body,
          clientMessageId,
          user: socket.user,
        });

        if (!result.ok) {
          return sendAck(result);
        }

        sendAck({ ok: true, message: result.message, ticket: result.ticket });

        // Broadcast to agents room and customer room (exclude sender)
        if (!result.isDuplicate) {
          const customerRoom = `customer:${result.ticket.customerId}`;
          socket.to('agents').to(customerRoom).emit('message:new', {
            message: result.message,
            ticketId: result.ticket.id,
          });
        }
      } else {
        // Customer sending message
        // Rate limit: 20 messages per minute per customer socket
        const now = Date.now();
        while (messageTimestamps.length > 0 && messageTimestamps[0] <= now - 60000) {
          messageTimestamps.shift();
        }

        if (messageTimestamps.length >= 20) {
          return sendAck({
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Batas pengiriman pesan terlampaui (maksimal 20 pesan per menit).',
            },
          });
        }

        messageTimestamps.push(now);

        const parsed = customerMessageSchema.safeParse(payload);
        if (!parsed.success) {
          return sendAck({
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Input pesan tidak valid.',
              details: parsed.error.flatten().fieldErrors,
            },
          });
        }

        const { body, clientMessageId } = parsed.data;
        const result = await chatService.sendCustomerMessage({
          customer: socket.customer,
          body,
          clientMessageId,
        });

        if (!result.ok) {
          return sendAck(result);
        }

        sendAck({ ok: true, message: result.message, ticket: result.ticket });

        if (!result.isDuplicate) {
          const customerRoom = `customer:${socket.customer.id}`;

          // Broadcast customer's message to staff and other sockets of this customer
          socket.to('agents').to(customerRoom).emit('message:new', {
            message: result.message,
            ticketId: result.ticket.id,
          });

          // Broadcast ticket events & trigger FCM push (non-blocking)
          if (result.isNewTicket) {
            io.to('agents').emit('ticket:created', result.ticket);
            notificationService.notifyTicketCreated({
              ticket: result.ticket,
              customerName: socket.customer?.name,
              body,
            }).catch(() => {});
          } else if (result.isReopened) {
            io.to('agents').to(customerRoom).emit('ticket:updated', result.ticket);
            notificationService.notifyTicketReopened({
              ticket: result.ticket,
              customerName: socket.customer?.name,
              body,
            }).catch(() => {});
          } else {
            notificationService.notifyCustomerMessage({
              ticket: result.ticket,
              customerName: socket.customer?.name,
              body,
            }).catch(() => {});
          }

          // If SYSTEM message was generated, broadcast to both sides
          if (result.systemMessage) {
            io.to('agents').to(customerRoom).emit('message:new', {
              message: result.systemMessage,
              ticketId: result.ticket.id,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Socket] Error in message:send:', err);
      sendAck({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Gagal memproses pesan.' },
      });
    }
  });

  // ── Event: sync:request ───────────────────────────────────────────────────
  socket.on('sync:request', async (payload, ack) => {
    const sendAck = typeof ack === 'function' ? ack : () => {};

    try {
      if (socket.isStaff) {
        const parsed = staffSyncSchema.safeParse(payload);
        const tickets = parsed.success ? parsed.data?.tickets || [] : [];
        const messages = await chatService.syncStaffMessages(tickets);
        sendAck({ ok: true, messages });
      } else {
        const parsed = customerSyncSchema.safeParse(payload);
        const lastMessageId = parsed.success ? parsed.data?.lastMessageId : undefined;
        const messages = await chatService.syncCustomerMessages(
          socket.customer.id,
          lastMessageId
        );
        sendAck({ ok: true, messages });
      }
    } catch (err) {
      console.error('[Socket] Error in sync:request:', err);
      sendAck({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Gagal melakukan sinkronisasi pesan.' },
      });
    }
  });
}
