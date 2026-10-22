/**
 * src/index.js
 * Widget entry point.
 *
 * Boot sequence:
 *  1. config.js captured document.currentScript synchronously before async tasks
 *  2. Wait for DOM ready
 *  3. initUI() → Shadow DOM attached and styled
 *  4. Load visitorToken from localStorage
 *     a. If none → showFormView(), bindFormSubmit()
 *     b. If exists → GET /widget/conversation
 *        - 401/404 → clearSession() + showFormView()
 *        - ok → show chat, init socket immediately on page load (PRD item 2)
 *  5. Socket:
 *     - On connect → sync:request + flushQueue (mutex-guarded)
 *     - Periodic retry timer (5-10s)
 *     - message:new → deduplicated and appended (or status updated)
 *     - ticket:updated → update state
 *  6. Form submit → POST /widget/session → init chat + socket
 */

// config.js MUST be the very first import to read document.currentScript synchronously
import { config } from './config.js'; // eslint-disable-line no-unused-vars
import { postSession, getConversation } from './api.js';
import {
  loadVisitorToken,
  saveVisitorToken,
  clearSession,
  setCustomer,
  setTicket,
  setMessages,
  addMessages,
  enqueuePending,
  confirmPending,
  failPending,
  getState,
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
  updateMessageStatus,
  showClosedNotice,
  bindInputBar,
  on as uiOn,
} from './ui.js';
import {
  initSocket,
  destroySocket,
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
  // 1. Build Shadow DOM & UI shell
  initUI();

  // Listen to session invalidation (e.g. socket auth rejection)
  uiOn('session:invalid', () => {
    destroySocket();
    clearSession();
    renderMessages([]);
    showFormView();
    bindFormSubmit();
    setFormError('Sesi berakhir. Silakan masukkan nama kembali.');
  });

  const token = loadVisitorToken();

  if (!token) {
    // No visitor token saved → show name registration form
    showFormView();
    bindFormSubmit();
    return;
  }

  // Token exists → load conversation and connect socket
  await loadConversation(token);
}

// ── Load conversation (existing session) ──────────────────────────────────────

async function loadConversation(token) {
  try {
    const data = await getConversation(token);

    // Populate store
    setCustomer(data.customer);
    setTicket(data.ticket);
    setMessages(data.messages || []);

    showChatView();
    renderMessages(getState().messages);

    if (data.ticket?.status === 'CLOSED') {
      showClosedNotice(true);
    }

    bindInputBar(handleSend);

    // Requirement 2: Connect socket immediately when page loads if visitorToken exists
    initSocket(token);

  } catch (err) {
    // Requirement 1: If 401 or 404, remove token and local data, show name form again
    destroySocket();
    clearSession();
    renderMessages([]);
    showFormView();
    bindFormSubmit();

    if (err.status !== 401 && err.status !== 404) {
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

    // Connect socket on session start
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

  // Reset closed notice if opening new ticket
  const state = getState();
  if (state.ticket?.status === 'CLOSED') {
    showClosedNotice(false);
    setTicket(null);
  }

  // Optimistic UI: enqueue to pendingQueue, record in state.messages, and append to DOM
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
  addMessages(pendingMsg);
  appendMessage(pendingMsg);

  // Send via socket
  const ack = await sendMessage(clientMessageId, body);

  if (ack?.ok) {
    confirmPending(clientMessageId, ack.message);
    if (ack.ticket) {
      setTicket(ack.ticket);
    }
    updateMessageStatus(clientMessageId, 'sent', ack.message);
  } else if (ack?.ok === false) {
    if (ack.code === 'RATE_LIMITED' || ack.code === 'TIMEOUT' || ack.code === 'DISCONNECTED') {
      // Requirement 4: RATE_LIMITED and timeout stay pending, retried with delay
    } else {
      // Requirement 4: Validation error marked as "gagal terkirim" with discard option, not retried
      failPending(clientMessageId);
      updateMessageStatus(clientMessageId, 'failed');
    }
  }
}
