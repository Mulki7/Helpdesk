/**
 * src/socket/index.js
 * Socket.IO client for staff (agents & admins).
 *
 * Implements:
 *   - Auth handshake with JWT accessToken
 *   - Auto-refresh token on connect_error UNAUTHORIZED
 *   - Reconnect backoff and connection state tracking
 *   - Mutex-guarded pending queue flusher
 *   - message:send with ack & 10s timeout
 */

import { io } from 'socket.io-client';
import { getAccessToken, refreshAccessToken } from '../api/client.js';

let _socket = null;
let _flushRunning = false;
let _statusListeners = new Set();
let _eventListeners = new Map();

const ACK_TIMEOUT_MS = 10_000;

export async function withFlushLock(fn) {
  if (_flushRunning) return;
  _flushRunning = true;
  try {
    await fn();
  } finally {
    _flushRunning = false;
  }
}

export function subscribeConnectionStatus(listener) {
  _statusListeners.add(listener);
  return () => _statusListeners.delete(listener);
}

function notifyStatus(status) {
  _statusListeners.forEach((fn) => fn(status));
}

export function onSocketEvent(event, callback) {
  if (!_eventListeners.has(event)) {
    _eventListeners.set(event, new Set());
  }
  _eventListeners.get(event).add(callback);

  return () => {
    const set = _eventListeners.get(event);
    if (set) set.delete(callback);
  };
}

function dispatchEvent(event, data) {
  const listeners = _eventListeners.get(event);
  if (listeners) {
    listeners.forEach((fn) => fn(data));
  }
}

/**
 * Initialize or re-authenticate Socket.IO connection
 */
export function initSocket() {
  const token = getAccessToken();
  if (!token) return null;

  if (_socket) {
    _socket.auth = { token };
    if (!_socket.connected) {
      _socket.connect();
    }
    return _socket;
  }

  // Connect to current origin (handled by Vite proxy in dev, same origin in prod)
  _socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
  });

  _socket.on('connect', () => {
    notifyStatus('connected');
    dispatchEvent('connect');
  });

  _socket.on('disconnect', (reason) => {
    const isOffline = !navigator.onLine || reason === 'transport close';
    notifyStatus(isOffline ? 'offline' : 'reconnecting');
    dispatchEvent('disconnect', reason);
  });

  _socket.on('connect_error', async (err) => {
    notifyStatus('reconnecting');

    // If handshake rejected due to expired/invalid access token, refresh and reconnect
    if (err?.message === 'UNAUTHORIZED' || err?.message === 'jwt expired') {
      try {
        const { accessToken } = await refreshAccessToken();
        if (_socket) {
          _socket.auth = { token: accessToken };
          _socket.connect();
        }
      } catch (refreshErr) {
        console.error('[Socket] Token refresh on connect_error failed:', refreshErr);
      }
    }
  });

  // Listen to server broadcast events
  _socket.on('ticket:created', (ticket) => dispatchEvent('ticket:created', ticket));
  _socket.on('ticket:updated', (ticket) => dispatchEvent('ticket:updated', ticket));
  _socket.on('message:new', (payload) => dispatchEvent('message:new', payload));

  return _socket;
}

export function disconnectSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

/**
 * Send message with 10s ack timeout
 */
export function sendStaffMessage({ ticketId, body, clientMessageId }) {
  return new Promise((resolve) => {
    if (!_socket || !_socket.connected) {
      resolve({ ok: false, code: 'DISCONNECTED', message: 'Socket terputus' });
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, code: 'TIMEOUT', message: 'Waktu kirim habis (timeout)' });
    }, ACK_TIMEOUT_MS);

    _socket.emit(
      'message:send',
      { ticketId: Number(ticketId), body, clientMessageId },
      (ack) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ack || { ok: false, code: 'UNKNOWN_ERROR' });
      }
    );
  });
}

/**
 * Request missed messages for open ticket(s)
 */
export function requestSync(tickets) {
  return new Promise((resolve) => {
    if (!_socket || !_socket.connected) {
      resolve({ ok: false, messages: [] });
      return;
    }

    _socket.emit('sync:request', { tickets }, (res) => {
      resolve(res || { ok: false, messages: [] });
    });
  });
}
