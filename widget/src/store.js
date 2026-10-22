/**
 * src/store.js
 * In-memory state for the widget + localStorage persistence for pending queue.
 *
 * State shape:
 *   customer        — { id, name, email, visitorToken } | null
 *   ticket          — current ticket object | null
 *   messages        — Message[] (deduplicated, sorted by id asc)
 *   pendingQueue    — PendingMsg[] (messages not yet acked by server)
 *   lastMessageId   — highest message.id received (used for sync)
 *   unreadCount     — messages received while panel is closed
 *   isOpen          — whether the chat panel is visible
 *
 * PendingMsg shape:
 *   { clientMessageId, body, status: 'pending'|'failed', retries, noRetry }
 */

const LS_KEY_TOKEN = 'hd_visitor_token';
const LS_KEY_CUSTOMER = 'hd_customer';
const LS_KEY_PENDING = 'hd_pending_queue';

// ── Persisted helpers ─────────────────────────────────────────────────────────

export function loadVisitorToken() {
  return localStorage.getItem(LS_KEY_TOKEN) || null;
}

export function saveVisitorToken(token) {
  localStorage.setItem(LS_KEY_TOKEN, token);
}

export function clearSession() {
  localStorage.removeItem(LS_KEY_TOKEN);
  localStorage.removeItem(LS_KEY_CUSTOMER);
  localStorage.removeItem(LS_KEY_PENDING);
}

function loadPendingFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_PENDING) || '[]');
  } catch {
    return [];
  }
}

function savePendingToStorage(queue) {
  localStorage.setItem(LS_KEY_PENDING, JSON.stringify(queue));
}

// ── In-memory state ───────────────────────────────────────────────────────────

const state = {
  customer: null,
  ticket: null,
  messages: [],
  pendingQueue: loadPendingFromStorage(),
  lastMessageId: 0,
  unreadCount: 0,
  isOpen: false,
};

// ── Getters ───────────────────────────────────────────────────────────────────

export const getState = () => state;

export function getLastMessageId() {
  return state.lastMessageId;
}

export function getPendingQueue() {
  return [...state.pendingQueue];
}

// ── Setters ───────────────────────────────────────────────────────────────────

export function setCustomer(customer) {
  state.customer = customer;
}

export function setTicket(ticket) {
  state.ticket = ticket;
}

export function setOpen(open) {
  state.isOpen = open;
  if (open) {
    state.unreadCount = 0;
  }
}

// ── Message deduplication ─────────────────────────────────────────────────────

/**
 * Add one or more messages to the store, deduplicating by:
 *   1. message.id (server-assigned)
 *   2. clientMessageId (for own pending messages matched to confirmed ones)
 *
 * Returns the list of actually-added messages.
 */
export function addMessages(incoming) {
  const newMessages = Array.isArray(incoming) ? incoming : [incoming];
  const added = [];

  for (const msg of newMessages) {
    const isDuplicate =
      // Duplicate by server id
      (msg.id && state.messages.some((m) => m.id === msg.id)) ||
      // Duplicate by clientMessageId (own messages: same clientMessageId, different tabs / reconnects)
      (msg.clientMessageId &&
        state.messages.some(
          (m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId
        ));

    if (!isDuplicate) {
      state.messages.push(msg);
      if (msg.id && msg.id > state.lastMessageId) {
        state.lastMessageId = msg.id;
      }
      added.push(msg);
    } else if (msg.id) {
      // Update existing pending/local message with server-confirmed data (id, status)
      const idx = state.messages.findIndex(
        (m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId
      );
      if (idx !== -1 && !state.messages[idx].id) {
        state.messages[idx] = { ...state.messages[idx], ...msg };
        if (msg.id > state.lastMessageId) state.lastMessageId = msg.id;
      }
    }
  }

  // Keep sorted by id (messages without id go to end)
  state.messages.sort((a, b) => {
    if (a.id && b.id) return a.id - b.id;
    if (a.id) return -1;
    if (b.id) return 1;
    return 0;
  });

  return added;
}

/**
 * Replace all messages (used after full conversation load).
 */
export function setMessages(messages) {
  state.messages = [];
  state.lastMessageId = 0;
  addMessages(messages);
}

// ── Pending queue ─────────────────────────────────────────────────────────────

/**
 * Enqueue a pending message (optimistic UI).
 */
export function enqueuePending(pendingMsg) {
  state.pendingQueue.push(pendingMsg);
  savePendingToStorage(state.pendingQueue);
}

/**
 * Mark a pending message as sent (confirmed by ack).
 * Also updates the corresponding in-memory message with server data.
 */
export function confirmPending(clientMessageId, serverMessage) {
  state.pendingQueue = state.pendingQueue.filter(
    (p) => p.clientMessageId !== clientMessageId
  );
  savePendingToStorage(state.pendingQueue);

  // Merge server data into in-memory message
  const idx = state.messages.findIndex(
    (m) => m.clientMessageId === clientMessageId
  );
  if (idx !== -1) {
    state.messages[idx] = { ...state.messages[idx], ...serverMessage, status: 'sent' };
    if (serverMessage.id && serverMessage.id > state.lastMessageId) {
      state.lastMessageId = serverMessage.id;
    }
  }
}

/**
 * Mark a pending message as failed (validation error — no retry).
 */
export function failPending(clientMessageId) {
  const item = state.pendingQueue.find((p) => p.clientMessageId === clientMessageId);
  if (item) {
    item.status = 'failed';
    item.noRetry = true;
    savePendingToStorage(state.pendingQueue);
  }
  const idx = state.messages.findIndex((m) => m.clientMessageId === clientMessageId);
  if (idx !== -1) {
    state.messages[idx] = { ...state.messages[idx], status: 'failed' };
  }
}

/**
 * Remove a failed message entirely (user chose to discard).
 */
export function discardFailed(clientMessageId) {
  state.pendingQueue = state.pendingQueue.filter(
    (p) => p.clientMessageId !== clientMessageId
  );
  savePendingToStorage(state.pendingQueue);
  state.messages = state.messages.filter(
    (m) => m.clientMessageId !== clientMessageId
  );
}

/**
 * Increment retry counter for a pending message.
 */
export function incrementRetry(clientMessageId) {
  const item = state.pendingQueue.find((p) => p.clientMessageId === clientMessageId);
  if (item) {
    item.retries = (item.retries || 0) + 1;
    savePendingToStorage(state.pendingQueue);
  }
}

/**
 * Returns only retryable pending messages (status !== 'failed', noRetry !== true).
 */
export function getRetryableQueue() {
  return state.pendingQueue.filter((p) => !p.noRetry && p.status !== 'failed');
}

// ── Unread counter ────────────────────────────────────────────────────────────

export function incrementUnread() {
  state.unreadCount += 1;
}

export function resetUnread() {
  state.unreadCount = 0;
}
