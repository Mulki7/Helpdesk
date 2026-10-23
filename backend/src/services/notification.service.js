/**
 * services/notification.service.js
 * FCM Push Notification Service using Firebase Admin SDK.
 * Sends push notifications only to offline staff members.
 * Non-blocking, fails gracefully as no-op if FCM is unconfigured.
 */

import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { isUserOnline } from './presence.service.js';

let firebaseApp = null;
let messaging = null;

function initFirebase() {
  if (!env.FCM_SERVICE_ACCOUNT_PATH) {
    console.log('ℹ️ [FCM] FCM_SERVICE_ACCOUNT_PATH tidak diatur. Push notification nonaktif (no-op).');
    return;
  }

  const resolvedPath = path.resolve(process.cwd(), env.FCM_SERVICE_ACCOUNT_PATH);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`⚠️ [FCM] File service account tidak ditemukan di: ${resolvedPath}. Push notification nonaktif (no-op).`);
    return;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    messaging = getMessaging(firebaseApp);
    console.log('✅ [FCM] Firebase Admin SDK berhasil diinisialisasi untuk Push Notification.');
  } catch (err) {
    console.error('❌ [FCM] Gagal inisialisasi Firebase Admin SDK:', err.message);
  }
}

initFirebase();

/**
 * Format nomor tiket HD-0001
 * @param {number} id
 * @returns {string}
 */
function formatTicketNumber(id) {
  return `HD-${String(id).padStart(4, '0')}`;
}

/**
 * Kirim notifikasi push ke daftar userIds yang OFFLINE (tidak punya socket aktif).
 * Hapus token yang ditolak FCM secara otomatis.
 *
 * @param {object} params
 * @param {number[]} params.userIds - ID user staff tujuan
 * @param {string} params.title - Judul notifikasi
 * @param {string} params.body - Isi notifikasi (dipotong maks 100 karakter)
 * @param {string} params.type - Tipe payload data (e.g. TICKET_CREATED, TICKET_REOPENED, NEW_MESSAGE, TICKET_ASSIGNED)
 * @param {number|string} params.ticketId - ID tiket
 */
async function sendToOfflineUsers({ userIds, title, body, type, ticketId }) {
  if (!messaging) return;
  if (!userIds || userIds.length === 0) return;

  try {
    // Saring hanya user yang sedang OFFLINE
    const offlineUserIds = userIds.filter((id) => !isUserOnline(id));
    if (offlineUserIds.length === 0) return;

    // Ambil token perangkat untuk user offline
    const tokensRecords = await prisma.deviceToken.findMany({
      where: {
        userId: { in: offlineUserIds },
      },
      select: { token: true, userId: true },
    });

    if (tokensRecords.length === 0) return;

    const tokens = tokensRecords.map((r) => r.token);
    const truncatedBody = (body || '').slice(0, 100);

    const messagePayload = {
      tokens,
      notification: {
        title,
        body: truncatedBody,
      },
      data: {
        type: String(type),
        ticketId: String(ticketId),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'helpdesk_tickets',
          sound: 'default',
        },
      },
    };

    const response = await messaging.sendEachForMulticast(messagePayload);

    // Hapus token yang kedaluwarsa atau invalid dari database
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-argument' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.deviceToken.deleteMany({
          where: { token: { in: invalidTokens } },
        });
        console.log(`[FCM] Menghapus ${invalidTokens.length} token yang tidak valid.`);
      }
    }
  } catch (err) {
    console.error('[FCM] Error sending push notification:', err.message);
  }
}

/**
 * Pemicu: Tiket baru dibuat.
 * Penerima: seluruh staff (agen & admin) yang sedang OFFLINE.
 */
export async function notifyTicketCreated({ ticket, customerName, body }) {
  try {
    const allStaff = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const userIds = allStaff.map((u) => u.id);
    const ticketNum = formatTicketNumber(ticket.id);

    await sendToOfflineUsers({
      userIds,
      title: `Tiket Baru: ${ticketNum}`,
      body: customerName ? `${customerName}: ${body}` : (body || ticket.subject),
      type: 'TICKET_CREATED',
      ticketId: ticket.id,
    });
  } catch (err) {
    console.error('[FCM] notifyTicketCreated error:', err.message);
  }
}

/**
 * Pemicu: Tiket dibuka kembali oleh customer.
 * Penerima: assignee jika offline, atau seluruh staff offline jika belum ada assignee.
 */
export async function notifyTicketReopened({ ticket, customerName, body }) {
  try {
    let userIds = [];
    if (ticket.assignedAgentId) {
      userIds = [ticket.assignedAgentId];
    } else {
      const allStaff = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      userIds = allStaff.map((u) => u.id);
    }
    const ticketNum = formatTicketNumber(ticket.id);

    await sendToOfflineUsers({
      userIds,
      title: `Tiket Dibuka Kembali: ${ticketNum}`,
      body: customerName ? `${customerName}: ${body}` : (body || ticket.subject),
      type: 'TICKET_REOPENED',
      ticketId: ticket.id,
    });
  } catch (err) {
    console.error('[FCM] notifyTicketReopened error:', err.message);
  }
}

/**
 * Pemicu: Pesan customer masuk pada tiket yang sudah di-assign.
 * Penerima: assignee jika offline.
 */
export async function notifyCustomerMessage({ ticket, customerName, body }) {
  try {
    if (!ticket.assignedAgentId) return; // tiket tanpa assignee tidak perlu kirim pesan customer ke personal
    const ticketNum = formatTicketNumber(ticket.id);

    await sendToOfflineUsers({
      userIds: [ticket.assignedAgentId],
      title: `Pesan Baru: ${ticketNum}`,
      body: customerName ? `${customerName}: ${body}` : body,
      type: 'NEW_MESSAGE',
      ticketId: ticket.id,
    });
  } catch (err) {
    console.error('[FCM] notifyCustomerMessage error:', err.message);
  }
}

/**
 * Pemicu: Tiket di-assign ke agen baru.
 * Penerima: agen baru jika offline.
 */
export async function notifyTicketAssigned({ ticket, targetAgentId }) {
  try {
    if (!targetAgentId) return;
    const ticketNum = formatTicketNumber(ticket.id);

    await sendToOfflineUsers({
      userIds: [targetAgentId],
      title: `Tiket Ditugaskan: ${ticketNum}`,
      body: `Anda ditugaskan pada tiket "${ticket.subject}".`,
      type: 'TICKET_ASSIGNED',
      ticketId: ticket.id,
    });
  } catch (err) {
    console.error('[FCM] notifyTicketAssigned error:', err.message);
  }
}

export default {
  notifyTicketCreated,
  notifyTicketReopened,
  notifyCustomerMessage,
  notifyTicketAssigned,
};
