/**
 * src/socket.js
 * Socket.IO client wrapper.
 *
 * Responsibilities:
 *  - Initialize socket with visitorToken auth
 *  - Handle connect / disconnect / connect_error
 *  - On connect: (1) sync:request, (2) flush pending queue (guarded by mutex)
 *  - Periodic retry of pending queue every RETRY_INTERVAL_MS (guarded by same mutex)
 *  - Incoming message:new and ticket:updated events
 *  - message:send with ack handling (ok/RATE_LIMITED/validation error/timeout)
 */

import { io } from 'socket.io-client';
import { config } from './config.js';
import {
  getLastMessageId,
  getRetryableQueue,
  getPendingQueue,
  addMessages,
  setTicket,
  confirmPending,
  failPending,
  incrementRetry,
  getState,
  incrementUnread,
} from './store.js';
import { emit as uiEmit } from './ui.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACK_TIMEOUT_MS = 10_000;     // 10 seconds per PRD
const RETRY_INTERVAL_MS = 7_000;   // periodic retry every 7 seconds
const RATE_LIMIT_BACKOFF_MS = 15_000; // backoff after RATE_LIMITED ack

// ── Mutex ─────────────────────────────────────────────────────────────────────

let _flushRunning = false;

async function withFlushLock(fn) {
  if (_flushRunning) return;
  _flushRunning = true;
  try {
    await fn();
  } finally {
    _flushRunning = false;
  }
}

// ── Socket instance ───────────────────────────────────────────────────────────

let _socket = null;
let _retryTimer = null;

export function getSocket() {
  return _socket;
}

/**
 * Initialize socket connection for a customer.
 * Should be called once visitorToken is available.
 */
export function initSocket(visitorToken) {
  if (_socket) {
    // Already initialised — update auth and reconnect
    _socket.auth = { visitorToken };
    _socket.connect();
    return _socket;
  }

  _socket = io(config.server, {
    transports: ['websocket', 'polling'],
    auth: { visitorToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
  });

  // ── Event handlers ────────────────────────────────────────────────────────

  _socket.on('connect', () => {
    uiEmit('connection:status', 'connected');

    // 1. Sync: request messages missed while offline
    const lastId = getLastMessageId();
    _socket.emit('sync:request', { lastMessageId: lastId }, (res) => {
      if (res?.ok && Array.isArray(res.messages)) {
        const added = addMessages(res.messages);
        if (added.length > 0) {
          uiEmit('messages:synced', added);
        }
      }
    });

    // 2. Flush pending queue (after sync, guarded by mutex)
    withFlushLock(() => flushQueue());

    // 3. Start periodic retry timer
    startRetryTimer();
  });

  _socket.on('disconnect', (reason) => {
    stopRetryTimer();
    const isOffline = !navigator.onLine || reason === 'transport close';
    uiEmit('connection:status', isOffline ? 'offline' : 'reconnecting');
  });

  _socket.on('connect_error', (err) => {
    stopRetryTimer();
    uiEmit('connection:status', 'reconnecting');
    console.warn('[widget:socket] connect_error', err?.message);
  });

  _socket.on('message:new', (payload) => {
    const { message, ticketId } = payload;
    const added = addMessages([message]);
    if (added.length > 0) {
      // If panel is closed, count unread
      if (!getState().isOpen) {
        incrementUnread();
        uiEmit('unread:changed', getState().unreadCount);
      }
      uiEmit('message:new', { message, ticketId });
    }
  });

  _socket.on('presence:update', (payload) => {
    uiEmit('presence:update', payload);
  });

  _socket.on('ticket:updated', (ticket) => {
    setTicket(ticket);
    uiEmit('ticket:updated', ticket);
  });

  return _socket;
}

/**
 * Disconnect and clean up socket (e.g., on session clear).
 */
export function destroySocket() {
  stopRetryTimer();
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

// ── Message sending ───────────────────────────────────────────────────────────

/**
 * Send a message via socket with ack timeout handling.
 *
 * Returns a Promise that resolves to the ack result.
 * Handles:
 *   - ok: true  → confirm pending
 *   - ok: false, RATE_LIMITED → keep pending, backoff
 *   - ok: false, other error → mark failed (no retry)
 *   - timeout → keep pending (retry on reconnect / periodic flush)
 */
export function sendMessage(clientMessageId, body) {
  return new Promise((resolve) => {
    if (!_socket || !_socket.connected) {
      // Socket not connected — will be retried on reconnect
      resolve({ ok: false, code: 'DISCONNECTED' });
      return;
    }

    const payload = { body, clientMessageId };

    // Timeout guard
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // Keep pending — will retry
      incrementRetry(clientMessageId);
      resolve({ ok: false, code: 'TIMEOUT' });
    }, ACK_TIMEOUT_MS);

    _socket.emit('message:send', payload, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

// ── Flush pending queue ───────────────────────────────────────────────────────

/**
 * Send all retryable pending messages sequentially.
 * Must be called inside withFlushLock to prevent parallel flushes.
 */
async function flushQueue() {
  const queue = getRetryableQueue();
  for (const item of queue) {
    if (!_socket?.connected) break; // stop if disconnected mid-flush

    const ack = await sendMessage(item.clientMessageId, item.body);

    if (ack.ok) {
      confirmPending(item.clientMessageId, ack.message);
      uiEmit('message:confirmed', { clientMessageId: item.clientMessageId, message: ack.message });
    } else if (ack.code === 'RATE_LIMITED') {
      // Wait for backoff, then continue with next (this one stays pending)
      await sleep(RATE_LIMIT_BACKOFF_MS);
    } else if (ack.code === 'TIMEOUT' || ack.code === 'DISCONNECTED') {
      // Stop flushing — socket lost, reconnect will trigger again
      break;
    } else if (ack.code) {
      // Validation or other permanent error
      failPending(item.clientMessageId);
      uiEmit('message:failed', { clientMessageId: item.clientMessageId, error: ack.error });
    }
  }
}

// ── Periodic retry timer ──────────────────────────────────────────────────────

function startRetryTimer() {
  stopRetryTimer();
  _retryTimer = setInterval(() => {
    if (_socket?.connected && getRetryableQueue().length > 0) {
      withFlushLock(() => flushQueue());
    }
  }, RETRY_INTERVAL_MS);
}

function stopRetryTimer() {
  if (_retryTimer) {
    clearInterval(_retryTimer);
    _retryTimer = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
