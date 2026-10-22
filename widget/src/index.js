/**
 * src/index.js
 * Widget entry point.
 *
 * Boot sequence:
 *  1. config.js already captured document.currentScript synchronously
 *  2. Wait for DOM ready
 *  3. initUI() → Shadow DOM ready
 *  4. Load visitorToken from localStorage
 *     a. If none → showFormView(), wait for form submit
 *     b. If exists → GET /widget/conversation
 *        - 401/404 → clearSession() + showFormView()
 *        - ok → show chat, init socket immediately (PRD: connect on load)
 *  5. Socket:
 *     - On connect → sync + flush queue
 *     - message:new → appendMessage (deduplicated)
 *     - ticket:updated → update state
 *  6. Form submit → POST /widget/session → init chat + socket
 */

// config.js is the FIRST import so document.currentScript is captured sync
import { config } from './config.js'; // eslint-disable-line no-unused-vars
import { postSession, getConversation } from './api.js';
import {
  loadVisitorToken,
  saveVisitorToken,
  clearSession,
  setCustomer,
  setTicket,
  setMessages,
  enqueuePending,
  confirmPending,
  failPending,
  getState,
  incrementUnread,
} from './store.js';
import {
  initUI,
  showFormView,
  showChatView,
  getFormValues,
  setFormError,
  setFormLoading,
  renderMessages,
  appendMessage,
  updatePresence,
  showClosedNotice,
  openPanel,
  updateBadge,
  bindInputBar,
} from './ui.js';
import {
  initSocket,
  sendMessage,
} from './socket.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

function onDOMReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

onDOMReady(boot);

async function boot() {
  // 1. Build Shadow DOM
  initUI();

  const token = loadVisitorToken();

  if (!token) {
    // No session → show registration form
    showFormView();
    bindFormSubmit();
    return;
  }

  // Has token → try to load conversation
  await loadConversation(token);
}

// ── Load conversation (existing session) ──────────────────────────────────────

async function loadConversation(token) {
  try {
    const data = await getConversation(token);
    // Success: populate state
    setCustomer(data.customer);
    setTicket(data.ticket);
    setMessages(data.messages || []);

    showChatView();
    renderMessages(getState().messages);

    if (data.ticket?.status === 'CLOSED') {
      showClosedNotice(true);
    }

    // Bind input
    bindInputBar(handleSend);

    // Connect socket immediately (do not wait for bubble click)
    initSocket(token);

    // Seed presence from initial ticket data
    // (will be updated by presence:update event on connect)

  } catch (err) {
    if (err.status === 401 || err.status === 404) {
      // Invalid / expired token → reset and show form
      clearSession();
      showFormView();
      bindFormSubmit();
    } else {
      // Network or server error — show form with error
      clearSession();
      showFormView();
      bindFormSubmit();
      setFormError('Gagal memuat percakapan. Silakan coba lagi.');
    }
  }
}

// ── Form submission ───────────────────────────────────────────────────────────

let _formBound = false;

function bindFormSubmit() {
  if (_formBound) return;
  _formBound = true;

  const btn = document
    .querySelector('#hd-widget-host')
    ?.shadowRoot?.querySelector('#hd-start-btn');

  if (!btn) return;

  btn.addEventListener('click', handleFormSubmit);

  // Also allow Enter in name field
  const nameInput = document
    .querySelector('#hd-widget-host')
    ?.shadowRoot?.querySelector('#hd-name-input');
  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFormSubmit();
    });
  }
}

async function handleFormSubmit() {
  setFormError('');
  const { name, email } = getFormValues();

  if (!name) {
    setFormError('Nama wajib diisi.');
    return;
  }

  setFormLoading(true);
  try {
    const existingToken = loadVisitorToken();
    const result = await postSession({
      name,
      email: email || undefined,
      visitorToken: existingToken || undefined,
    });

    saveVisitorToken(result.visitorToken);
    setCustomer(result.customer);

    showChatView();
    renderMessages([]);
    bindInputBar(handleSend);

    // Connect socket
    initSocket(result.visitorToken);

  } catch (err) {
    setFormError(err.message || 'Gagal memulai sesi. Coba lagi.');
  } finally {
    setFormLoading(false);
  }
}

// ── Send message ──────────────────────────────────────────────────────────────

async function handleSend(body) {
  const clientMessageId = crypto.randomUUID();
  const token = loadVisitorToken();
  if (!token) return;

  // If last ticket was CLOSED: reset UI for new ticket
  const state = getState();
  if (state.ticket?.status === 'CLOSED') {
    showClosedNotice(false);
    setTicket(null);
    // Don't clear messages — server will create new ticket and message:new will arrive
  }

  // Optimistic UI: add pending message
  const pendingMsg = {
    clientMessageId,
    body,
    senderType: 'CUSTOMER',
    status: 'pending',
    retries: 0,
    noRetry: false,
    createdAt: new Date().toISOString(),
  };
  enqueuePending(pendingMsg);
  appendMessage(pendingMsg);

  // Send via socket
  const ack = await sendMessage(clientMessageId, body);

  if (ack?.ok) {
    confirmPending(clientMessageId, ack.message);
    // Update ticket state if new ticket was created
    if (ack.ticket) {
      setTicket(ack.ticket);
    }
    // updateMessageStatus is called inside ui's internal 'message:confirmed' event
    // but we can also do it directly here for immediate feedback
    import('./ui.js').then(({ updateMessageStatus }) => {
      updateMessageStatus(clientMessageId, 'sent', ack.message);
    });
  } else if (ack?.ok === false) {
    if (ack.error?.code === 'RATE_LIMITED' || !ack.error?.code) {
      // Keep pending — will retry
    } else {
      // Permanent validation error — mark failed
      failPending(clientMessageId);
      import('./ui.js').then(({ updateMessageStatus }) => {
        updateMessageStatus(clientMessageId, 'failed');
      });
    }
  }
}
