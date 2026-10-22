/**
 * src/socket.js
 * Socket.IO client wrapper.
 *
 * Responsibilities:
 *  - Initialize socket with visitorToken auth
 *  - Handle connect / disconnect / connect_error
 *  - On connect: (1) sync:request, (2) flush pending queue (guarded by mutex)
 *  - Periodic retry of pending queue every RETRY_INTERVAL_MS (5-10s, guarded by same mutex)
 *  - Incoming message:new and ticket:updated events
 *  - message:send with ack handling:
 *      * ok: true → confirm pending
 *      * RATE_LIMITED / timeout → keep pending, retry with backoff
 *      * validation error → fail pending (mark failed with delete option, no retry)
 */

import { io } from 'socket.io-client';
import { config } from './config.js';
import {
  getLastMessageId,
  getRetryableQueue,
  addMessages,
  setTicket,
  confirmPending,
  failPending,
  incrementRetry,
  getState,
  incrementUnread,
  clearSession,
} from './store.js';
import { emit as uiEmit } from './ui.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACK_TIMEOUT_MS = 10_000;         // 10 seconds timeout per PRD
const RETRY_INTERVAL_MS = 7_000;       // Periodic retry every 7 seconds (5-10s window)
const RATE_LIMIT_BACKOFF_MS = 15_000;   // Backoff after RATE_LIMITED ack

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
 * Called immediately on load when visitorToken exists, or after registration.
 */
export function initSocket(visitorToken) {
  if (_socket) {
    _socket.auth = { visitorToken };
    if (!_socket.connected) {
      _socket.connect();
    }
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

    // 1. Sync missed messages while disconnected
    const lastId = getLastMessageId();
    _socket.emit('sync:request', { lastMessageId: lastId }, (res) => {
      if (res?.ok && Array.isArray(res.messages)) {
        const added = addMessages(res.messages);
        if (added.length > 0) {
          uiEmit('messages:synced', added);
        }
      }
    });

    // 2. Flush pending queue (guarded by mutex)
    withFlushLock(() => flushQueue());

    // 3. Start periodic retry timer (5-10 seconds)
    startRetryTimer();
  });

  _socket.on('disconnect', (reason) => {
    stopRetryTimer();
    const isOffline = !navigator.onLine || reason === 'transport close';
    uiEmit('connection:status', isOffline ? 'offline' : 'reconnecting');
  });

  _socket.on('connect_error', (err) => {
    stopRetryTimer();

    // If server rejected token (401/404 equivalent in socket auth)
    if (
      err?.message === 'CUSTOMER_NOT_FOUND' ||
      err?.message === 'UNAUTHORIZED'
    ) {
      clearSession();
      destroySocket();
      uiEmit('session:invalid');
      return;
    }

    uiEmit('connection:status', 'reconnecting');
    console.warn('[widget:socket] connect_error', err?.message);
  });

  _socket.on('message:new', (payload) => {
    const { message, ticketId } = payload;
    const added = addMessages([message]);

    if (added.length > 0) {
      // If panel is closed, increment unread badge
      if (!getState().isOpen) {
        incrementUnread();
        uiEmit('unread:changed', getState().unreadCount);
      }
      uiEmit('message:new', { message, ticketId });
    } else if (message?.clientMessageId) {
      // Message was already added as pending; mark confirmed
      uiEmit('message:confirmed', {
        clientMessageId: message.clientMessageId,
        message,
      });
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
 * Disconnect and clean up socket (e.g. on 401/404 or logout).
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
 * Normalizes ack result:
 *   - ok: true  → { ok: true, message, ticket }
 *   - ok: false, RATE_LIMITED → { ok: false, code: 'RATE_LIMITED' }
 *   - ok: false, VALIDATION_ERROR → { ok: false, code: 'VALIDATION_ERROR', error }
 *   - timeout → { ok: false, code: 'TIMEOUT' }
 *   - disconnected → { ok: false, code: 'DISCONNECTED' }
 */
export function sendMessage(clientMessageId, body) {
  return new Promise((resolve) => {
    if (!_socket || !_socket.connected) {
      resolve({ ok: false, code: 'DISCONNECTED' });
      return;
    }

    const payload = { body, clientMessageId };

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      incrementRetry(clientMessageId);
      resolve({ ok: false, code: 'TIMEOUT' });
    }, ACK_TIMEOUT_MS);

    _socket.emit('message:send', payload, (ack) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (ack && !ack.ok) {
        const code = ack.code || ack.error?.code || 'UNKNOWN_ERROR';
        resolve({ ...ack, code });
      } else {
        resolve(ack || { ok: false, code: 'UNKNOWN_ERROR' });
      }
    });
  });
}

// ── Flush pending queue ───────────────────────────────────────────────────────

/**
 * Send all retryable pending messages sequentially.
 * Guarded by withFlushLock to ensure flushQueue never runs concurrently.
 */
async function flushQueue() {
  const queue = getRetryableQueue();
  for (const item of queue) {
    if (!_socket?.connected) break;

    const ack = await sendMessage(item.clientMessageId, item.body);

    if (ack.ok) {
      confirmPending(item.clientMessageId, ack.message);
      uiEmit('message:confirmed', {
        clientMessageId: item.clientMessageId,
        message: ack.message,
      });
    } else if (ack.code === 'RATE_LIMITED') {
      // Keep pending; wait backoff and retry next interval
      await sleep(RATE_LIMIT_BACKOFF_MS);
      break;
    } else if (ack.code === 'TIMEOUT' || ack.code === 'DISCONNECTED') {
      // Network/transport issue — stop flush loop, will retry on timer / reconnect
      break;
    } else {
      // Validation error or other permanent reject — mark failed, do not retry automatically
      failPending(item.clientMessageId);
      uiEmit('message:failed', {
        clientMessageId: item.clientMessageId,
        error: ack.error,
      });
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
