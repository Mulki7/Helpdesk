/**
 * src/ui.js
 * All DOM rendering inside Shadow DOM.
 *
 * This module owns the Shadow root and exposes:
 *   - initUI()         → creates host element + shadow root, injects styles + skeleton
 *   - emit(event, data) → internal event bus (used by socket.js to notify ui)
 *   - on(event, cb)    → subscribe to internal events
 *
 * Text from user content is ALWAYS set via textContent (never innerHTML) to prevent XSS.
 */

import { config } from './config.js';
import {
  getState,
  setOpen,
  resetUnread,
  discardFailed,
} from './store.js';

// ── Internal event bus ────────────────────────────────────────────────────────

const _listeners = {};

export function emit(event, data) {
  (_listeners[event] || []).forEach((cb) => cb(data));
}

export function on(event, cb) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(cb);
}

// ── Shadow DOM references ─────────────────────────────────────────────────────

let _shadow = null;

// Helpers to query inside shadow
const $ = (sel) => _shadow && _shadow.querySelector(sel);
const $$ = (sel) => _shadow ? [..._shadow.querySelectorAll(sel)] : [];

// ── Colour utilities ──────────────────────────────────────────────────────────

/** Darkens a hex colour slightly for hover states */
function darken(hex) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - 30);
    const g = Math.max(0, ((n >> 8) & 0xff) - 30);
    const b = Math.max(0, (n & 0xff) - 30);
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return hex;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

function buildStyles() {
  const c = config.color;
  const cd = darken(c);
  return `
    :host { all: initial; font-family: system-ui, -apple-system, sans-serif; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Bubble button ── */
    #hd-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483646;
      width: 56px; height: 56px; border-radius: 50%;
      background: ${c}; border: none; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, transform .15s;
    }
    #hd-bubble:hover { background: ${cd}; transform: scale(1.07); }
    #hd-bubble svg { width: 26px; height: 26px; fill: #fff; }

    /* Unread badge */
    #hd-badge {
      position: absolute; top: 0; right: 0;
      background: #ef4444; color: #fff;
      font-size: 11px; font-weight: 700; line-height: 1;
      min-width: 18px; height: 18px;
      border-radius: 9px; padding: 0 4px;
      display: none; align-items: center; justify-content: center;
      border: 2px solid #fff;
    }
    #hd-badge.visible { display: flex; }

    /* ── Panel ── */
    #hd-panel {
      position: fixed; bottom: 92px; right: 24px; z-index: 2147483645;
      width: 360px; height: 520px; max-height: calc(100vh - 110px);
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.92) translateY(12px); opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.4,0,.2,1), opacity .2s;
    }
    #hd-panel.open {
      transform: scale(1) translateY(0); opacity: 1; pointer-events: auto;
    }
    @media (max-width: 480px) {
      #hd-panel {
        bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; height: 100%; max-height: 100%;
        border-radius: 0;
      }
    }

    /* ── Header ── */
    #hd-header {
      background: ${c}; color: #fff;
      padding: 14px 16px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    #hd-header-title { flex: 1; font-size: 15px; font-weight: 600; }
    #hd-status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #86efac; flex-shrink: 0;
      box-shadow: 0 0 0 2px rgba(255,255,255,.35);
    }
    #hd-status-dot.offline { background: #fca5a5; }
    #hd-close-btn {
      background: none; border: none; color: #fff; cursor: pointer;
      padding: 4px; border-radius: 6px; display: flex;
      transition: background .15s;
    }
    #hd-close-btn:hover { background: rgba(255,255,255,.2); }
    #hd-close-btn svg { width: 18px; height: 18px; fill: currentColor; }

    /* ── Connection banner ── */
    #hd-banner {
      background: #fef3c7; color: #92400e;
      font-size: 12px; padding: 7px 14px;
      display: none; align-items: center; gap: 6px;
      flex-shrink: 0;
    }
    #hd-banner.visible { display: flex; }
    #hd-banner.offline { background: #fee2e2; color: #991b1b; }

    /* ── Views ── */
    .hd-view { display: none; flex-direction: column; flex: 1; overflow: hidden; }
    .hd-view.active { display: flex; }

    /* ── Form view ── */
    #hd-form-view { padding: 24px 20px; gap: 14px; justify-content: center; }
    #hd-form-view p {
      font-size: 13px; color: #6b7280; line-height: 1.5; text-align: center;
    }
    .hd-field { display: flex; flex-direction: column; gap: 5px; }
    .hd-field label { font-size: 12px; font-weight: 600; color: #374151; }
    .hd-field input {
      border: 1.5px solid #d1d5db; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; outline: none;
      transition: border-color .15s;
    }
    .hd-field input:focus { border-color: ${c}; }
    #hd-form-error { font-size: 12px; color: #dc2626; display: none; }
    #hd-form-error.visible { display: block; }
    .hd-btn {
      background: ${c}; color: #fff; border: none;
      border-radius: 8px; padding: 10px 16px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .15s; display: flex; align-items: center;
      justify-content: center; gap: 6px;
    }
    .hd-btn:hover { background: ${cd}; }
    .hd-btn:disabled { opacity: .6; cursor: not-allowed; }

    /* ── Chat view ── */
    #hd-chat-view { overflow: hidden; }
    #hd-messages {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    #hd-messages::-webkit-scrollbar { width: 4px; }
    #hd-messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }

    /* Closed notice */
    #hd-closed-notice {
      display: none; font-size: 12px; color: #6b7280;
      text-align: center; background: #f9fafb;
      border-radius: 8px; padding: 10px 12px; margin: 0 4px;
    }
    #hd-closed-notice.visible { display: block; }

    /* Message bubbles */
    .hd-msg-row {
      display: flex; flex-direction: column;
    }
    .hd-msg-row.customer { align-items: flex-end; }
    .hd-msg-row.agent { align-items: flex-start; }
    .hd-msg-row.system { align-items: center; }

    .hd-msg-sender {
      font-size: 10px; color: #9ca3af; margin-bottom: 2px; padding: 0 4px;
    }

    .hd-bubble {
      max-width: 80%; padding: 9px 13px; border-radius: 16px;
      font-size: 13.5px; line-height: 1.5; word-break: break-word;
      white-space: pre-wrap;
    }
    .hd-msg-row.customer .hd-bubble {
      background: ${c}; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .hd-msg-row.agent .hd-bubble {
      background: #f3f4f6; color: #111827;
      border-bottom-left-radius: 4px;
    }
    .hd-msg-row.system .hd-bubble {
      background: #fef9c3; color: #713f12;
      font-size: 12px; max-width: 90%;
      border-radius: 8px; padding: 7px 12px;
    }

    /* Status indicator under customer bubble */
    .hd-msg-status {
      font-size: 10px; color: rgba(255,255,255,.7);
      display: flex; align-items: center; gap: 3px;
      margin-top: 2px; padding-right: 4px;
    }
    .hd-msg-status.dark { color: #9ca3af; }
    .hd-msg-status svg { width: 11px; height: 11px; }

    /* Failed message */
    .hd-msg-row.failed .hd-bubble {
      background: #fee2e2; color: #991b1b;
    }
    .hd-discard-btn {
      font-size: 10px; color: #dc2626; background: none; border: none;
      cursor: pointer; padding: 1px 4px; text-decoration: underline;
      margin-top: 1px;
    }

    /* ── Input bar ── */
    #hd-input-bar {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #f3f4f6; flex-shrink: 0;
    }
    #hd-input {
      flex: 1; resize: none; border: 1.5px solid #e5e7eb;
      border-radius: 10px; padding: 9px 12px;
      font-size: 13.5px; font-family: inherit;
      outline: none; max-height: 100px; line-height: 1.4;
      transition: border-color .15s;
    }
    #hd-input:focus { border-color: ${c}; }
    #hd-input::placeholder { color: #9ca3af; }
    #hd-send-btn {
      background: ${c}; border: none; border-radius: 10px;
      width: 40px; flex-shrink: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    #hd-send-btn:hover { background: ${cd}; }
    #hd-send-btn svg { width: 18px; height: 18px; fill: #fff; }

    /* ── Spinner ── */
    .hd-spinner {
      width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: hd-spin .7s linear infinite;
    }
    @keyframes hd-spin { to { transform: rotate(360deg); } }
  `;
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const ICONS = {
  chat: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>`,
  send: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>`,
  clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
  </svg>`,
  check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>`,
  warn: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
  </svg>`,
};

// ── HTML skeleton ─────────────────────────────────────────────────────────────

function buildSkeleton() {
  return `
    <!-- Bubble trigger -->
    <button id="hd-bubble" aria-label="Buka chat bantuan">
      ${ICONS.chat}
      <span id="hd-badge" aria-label="pesan belum dibaca"></span>
    </button>

    <!-- Chat panel -->
    <div id="hd-panel" role="dialog" aria-label="Live chat" aria-modal="true">

      <!-- Header -->
      <div id="hd-header">
        <span id="hd-status-dot" title="Status agen"></span>
        <span id="hd-header-title"></span>
        <button id="hd-close-btn" aria-label="Tutup chat">${ICONS.close}</button>
      </div>

      <!-- Connection banner -->
      <div id="hd-banner" role="status" aria-live="polite"></div>

      <!-- Form view (registration) -->
      <div id="hd-form-view" class="hd-view">
        <p>Halo! Tinggalkan nama Anda dan kami akan segera membantu.</p>
        <div class="hd-field">
          <label for="hd-name-input">Nama <span aria-hidden="true">*</span></label>
          <input id="hd-name-input" type="text" placeholder="Nama Anda" maxlength="100" autocomplete="name" />
        </div>
        <div class="hd-field">
          <label for="hd-email-input">Email <span style="color:#9ca3af;font-weight:400">(opsional)</span></label>
          <input id="hd-email-input" type="email" placeholder="email@contoh.com" maxlength="200" autocomplete="email" />
        </div>
        <span id="hd-form-error" role="alert"></span>
        <button class="hd-btn" id="hd-start-btn">Mulai Chat</button>
      </div>

      <!-- Chat view -->
      <div id="hd-chat-view" class="hd-view">
        <div id="hd-messages" aria-live="polite" aria-label="Percakapan"></div>
        <div id="hd-closed-notice"></div>
        <div id="hd-input-bar">
          <textarea id="hd-input" rows="1" placeholder="Tulis pesan..." maxlength="2000" aria-label="Pesan"></textarea>
          <button id="hd-send-btn" aria-label="Kirim pesan">${ICONS.send}</button>
        </div>
      </div>

    </div>
  `;
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Creates the host element, attaches Shadow DOM, injects CSS + HTML skeleton.
 * Returns the shadow root.
 */
export function initUI() {
  const host = document.createElement('div');
  host.setAttribute('id', 'hd-widget-host');
  document.body.appendChild(host);

  _shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = buildStyles();
  _shadow.appendChild(style);

  // Inject HTML
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildSkeleton();
  while (wrapper.firstChild) _shadow.appendChild(wrapper.firstChild);

  // Set header title
  const titleEl = $('#hd-header-title');
  if (titleEl) titleEl.textContent = config.title;

  // Bubble click
  $('#hd-bubble').addEventListener('click', togglePanel);

  // Close button
  $('#hd-close-btn').addEventListener('click', closePanel);

  // Register internal event listeners
  _registerInternalEvents();

  return _shadow;
}

// ── Panel open/close ──────────────────────────────────────────────────────────

function togglePanel() {
  if (getState().isOpen) closePanel();
  else openPanel();
}

export function openPanel() {
  const panel = $('#hd-panel');
  if (panel) panel.classList.add('open');
  setOpen(true);
  resetUnread();
  updateBadge(0);
  emit('panel:opened');
}

export function closePanel() {
  const panel = $('#hd-panel');
  if (panel) panel.classList.remove('open');
  setOpen(false);
  emit('panel:closed');
}

// ── View switching ────────────────────────────────────────────────────────────

export function showFormView() {
  $$('.hd-view').forEach((v) => v.classList.remove('active'));
  const view = $('#hd-form-view');
  if (view) view.classList.add('active');
}

export function showChatView() {
  $$('.hd-view').forEach((v) => v.classList.remove('active'));
  const view = $('#hd-chat-view');
  if (view) view.classList.add('active');
}

// ── Form helpers ──────────────────────────────────────────────────────────────

export function getFormValues() {
  return {
    name: ($('#hd-name-input')?.value || '').trim(),
    email: ($('#hd-email-input')?.value || '').trim() || undefined,
  };
}

export function setFormError(msg) {
  const el = $('#hd-form-error');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.add('visible');
  } else {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

export function setFormLoading(loading) {
  const btn = $('#hd-start-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<span class="hd-spinner"></span> Memulai...`
    : 'Mulai Chat';
}

// ── Messages rendering ────────────────────────────────────────────────────────

/** Append a single message row to the messages container */
export function appendMessage(msg) {
  const container = $('#hd-messages');
  if (!container) return;

  const type = (msg.senderType || 'CUSTOMER').toLowerCase();
  const status = msg.status || 'sent'; // 'pending' | 'sent' | 'failed'

  const row = document.createElement('div');
  row.classList.add('hd-msg-row', type === 'system' ? 'system' : type);
  if (status === 'failed') row.classList.add('failed');
  row.dataset.clientId = msg.clientMessageId || '';
  row.dataset.msgId = msg.id || '';

  // Agent name label
  if (type === 'agent' && msg.senderUser?.name) {
    const sender = document.createElement('span');
    sender.className = 'hd-msg-sender';
    sender.textContent = msg.senderUser.name;
    row.appendChild(sender);
  }

  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'hd-bubble';
  bubble.textContent = msg.body; // ALWAYS textContent — no XSS
  row.appendChild(bubble);

  // Status indicator (customer only)
  if (type === 'customer') {
    const statusEl = document.createElement('div');
    statusEl.className = 'hd-msg-status';
    statusEl.dataset.statusFor = msg.clientMessageId || '';

    if (status === 'pending') {
      statusEl.innerHTML = `${ICONS.clock} <span>Mengirim...</span>`;
    } else if (status === 'sent') {
      statusEl.innerHTML = `${ICONS.check} <span>Terkirim</span>`;
    } else if (status === 'failed') {
      statusEl.innerHTML = `${ICONS.warn} <span>Gagal terkirim</span>`;
      const discard = document.createElement('button');
      discard.className = 'hd-discard-btn';
      discard.textContent = 'Hapus';
      discard.addEventListener('click', () => {
        discardFailed(msg.clientMessageId);
        row.remove();
      });
      statusEl.appendChild(discard);
    }
    row.appendChild(statusEl);
  }

  container.appendChild(row);
  scrollToBottom();
}

/** Render multiple messages at once */
export function renderMessages(msgs) {
  const container = $('#hd-messages');
  if (!container) return;
  container.innerHTML = '';
  for (const m of msgs) appendMessage(m);
}

/** Update status indicator for a sent message */
export function updateMessageStatus(clientMessageId, status, serverMessage) {
  if (!_shadow) return;
  const row = _shadow.querySelector(`[data-client-id="${clientMessageId}"]`);
  if (row) {
    row.classList.remove('failed');
    if (status === 'sent') {
      row.dataset.msgId = serverMessage?.id || '';
    }
  }
  const statusEl = _shadow.querySelector(`[data-status-for="${clientMessageId}"]`);
  if (statusEl) {
    if (status === 'sent') {
      statusEl.innerHTML = `${ICONS.check} <span>Terkirim</span>`;
    } else if (status === 'failed') {
      statusEl.innerHTML = `${ICONS.warn} <span>Gagal terkirim</span>`;
      if (row) row.classList.add('failed');
      const discard = document.createElement('button');
      discard.className = 'hd-discard-btn';
      discard.textContent = 'Hapus';
      discard.addEventListener('click', () => {
        discardFailed(clientMessageId);
        if (row) row.remove();
      });
      statusEl.appendChild(discard);
    }
  }
}

// ── Closed ticket notice ──────────────────────────────────────────────────────

export function showClosedNotice(show) {
  const el = $('#hd-closed-notice');
  if (!el) return;
  if (show) {
    el.textContent =
      'Percakapan sebelumnya telah ditutup. Kirim pesan untuk memulai percakapan baru.';
    el.classList.add('visible');
    // Disable input bar
    const inputEl = $('#hd-input');
    const sendBtn = $('#hd-send-btn');
    if (inputEl) inputEl.disabled = false; // allow new message
    if (sendBtn) sendBtn.disabled = false;
  } else {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

// ── Status dot & banner ───────────────────────────────────────────────────────

export function updatePresence(agentsOnline) {
  const dot = $('#hd-status-dot');
  if (!dot) return;
  if (agentsOnline) {
    dot.classList.remove('offline');
    dot.title = 'Agen online';
  } else {
    dot.classList.add('offline');
    dot.title = 'Agen offline';
  }
}

export function updateConnectionBanner(status) {
  const banner = $('#hd-banner');
  if (!banner) return;
  banner.classList.remove('visible', 'offline');
  if (status === 'reconnecting') {
    banner.textContent = '🔄 Menyambungkan ulang...';
    banner.classList.add('visible');
  } else if (status === 'offline') {
    banner.textContent = '📵 Anda sedang offline. Pesan akan terkirim saat tersambung.';
    banner.classList.add('visible', 'offline');
  }
  // 'connected' → hide banner
}

// ── Unread badge ──────────────────────────────────────────────────────────────

export function updateBadge(count) {
  const badge = $('#hd-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.add('visible');
  } else {
    badge.textContent = '';
    badge.classList.remove('visible');
  }
}

// ── Input bar ────────────────────────────────────────────────────────────────

/**
 * Registers the send callback and keyboard shortcuts for the input area.
 */
export function bindInputBar(onSend) {
  const input = $('#hd-input');
  const btn = $('#hd-send-btn');
  if (!input || !btn) return;

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  // Enter to send, Shift+Enter for newline
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  btn.addEventListener('click', doSend);

  function doSend() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    onSend(text);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scrollToBottom() {
  const container = $('#hd-messages');
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

// ── Internal event wiring (from socket.js / index.js → UI updates) ────────────

function _registerInternalEvents() {
  // Connection status changes
  on('connection:status', (status) => {
    updateConnectionBanner(status);
  });

  // New message received from server
  on('message:new', ({ message }) => {
    appendMessage(message);
  });

  // Messages synced from sync:request
  on('messages:synced', (msgs) => {
    for (const m of msgs) appendMessage(m);
  });

  // Own message confirmed by server
  on('message:confirmed', ({ clientMessageId, message }) => {
    updateMessageStatus(clientMessageId, 'sent', message);
  });

  // Own message rejected (validation error)
  on('message:failed', ({ clientMessageId }) => {
    updateMessageStatus(clientMessageId, 'failed');
  });

  // Presence
  on('presence:update', ({ agentsOnline }) => {
    updatePresence(agentsOnline);
  });

  // Ticket updated (e.g., closed)
  on('ticket:updated', (ticket) => {
    if (ticket.status === 'CLOSED') {
      showClosedNotice(true);
    }
  });

  // Unread badge
  on('unread:changed', (count) => {
    updateBadge(count);
  });
}
