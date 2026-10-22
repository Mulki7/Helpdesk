/**
 * jobs/autoCloseTickets.js
 * Background job that runs every 1 minute to automatically close RESOLVED tickets
 * older than AUTO_CLOSE_HOURS (PRD section 8 rule 9).
 */

import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

/**
 * Perform one cycle of auto-closing eligible RESOLVED tickets.
 */
export async function closeExpiredTickets() {
  try {
    const cutoffMs = env.AUTO_CLOSE_HOURS * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - cutoffMs);

    const expiredTickets = await prisma.ticket.findMany({
      where: {
        status: 'RESOLVED',
        resolvedAt: {
          lte: cutoffDate,
        },
      },
      select: { id: true },
    });

    if (expiredTickets.length === 0) return;

    for (const { id } of expiredTickets) {
      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
          },
        });

        await tx.ticketEvent.create({
          data: {
            ticketId: id,
            actorUserId: null,
            type: 'STATUS_CHANGED',
            oldValue: 'RESOLVED',
            newValue: 'CLOSED',
          },
        });
      });
    }

    console.log(`[AutoClose] Menutup ${expiredTickets.length} tiket RESOLVED yang telah melewati batas.`);
  } catch (err) {
    console.error('[AutoClose] Error saat menjalankan auto-close job:', err);
  }
}

/**
 * Start recurring auto-close job running every 1 minute.
 * @returns {NodeJS.Timeout}
 */
export function startAutoCloseJob() {
  console.log(`[AutoClose] Job diaktifkan (interval: 1 menit, ambang: ${env.AUTO_CLOSE_HOURS} jam)`);
  // Run once shortly after startup, then every 60 seconds
  setTimeout(closeExpiredTickets, 5000);
  return setInterval(closeExpiredTickets, 60 * 1000);
}
