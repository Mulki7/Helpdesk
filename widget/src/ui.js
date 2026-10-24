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
  const c = config.color || '#10b981';
  const cd = darken(c);
  return `
    :host { all: initial; font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Bubble trigger ── */
    #hd-bubble {
      position: fixed;
      bottom: clamp(26px, 3.4vh + 10px, 46px);
      right: clamp(24px, 4vw, 56px);
      z-index: 2147483646;
      width: 56px; height: 56px; border-radius: 50%;
      background: #191c21; border: 2px solid rgba(255,255,255,.14); cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,.35);
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, transform .2s cubic-bezier(.34,1.56,.64,1);
      color: #fff;
    }
    #hd-bubble:hover { background: #252a32; transform: scale(1.08); }
    #hd-bubble svg { width: 26px; height: 26px; }

    /* Online status indicator on bubble */
    #hd-bubble-status {
      position: absolute; top: 2px; right: 2px;
      width: 12px; height: 12px; border-radius: 50%;
      background: #10b981; border: 2px solid #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,.25);
      transition: background .2s;
    }
    #hd-bubble-status.offline { background: #94a3b8; }

    /* Unread badge */
    #hd-badge {
      position: absolute; top: -3px; right: -3px;
      background: #ef4444; color: #fff;
      font-size: 10px; font-weight: 700; line-height: 1;
      min-width: 18px; height: 18px;
      border-radius: 9px; padding: 0 4px;
      display: none; align-items: center; justify-content: center;
      border: 2px solid #fff; z-index: 2;
    }
    #hd-badge.visible { display: flex; }

    /* ── Panel (Proportional and compact) ── */
    #hd-panel {
      position: fixed;
      bottom: clamp(92px, 3.4vh + 74px, 114px);
      right: clamp(24px, 4vw, 56px);
      z-index: 2147483645;
      width: min(330px, calc(100vw - 32px));
      height: min(440px, calc(100vh - 120px));
      background: #fff; border-radius: 16px;
      border: 1px solid rgba(0,0,0,.08);
      box-shadow: 0 16px 40px -4px rgba(15,23,42,.22), 0 4px 16px -2px rgba(15,23,42,.08);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(.93) translateY(12px); opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.16,1,.3,1), opacity .2s;
    }
    #hd-panel.open {
      transform: scale(1) translateY(0); opacity: 1; pointer-events: auto;
    }
    @media (max-width: 480px) {
      #hd-panel {
        bottom: 0; right: 0; left: 0; top: 0;
        width: 100%; height: 100%; max-height: 100%;
        border-radius: 0; border: none;
      }
    }

    /* ── Header ── */
    #hd-header {
      background: #191c21; color: #fff;
      padding: 12px 14px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,.06);
    }
    #hd-header-avatar {
      position: relative; width: 34px; height: 34px; border-radius: 50%;
      background: #064e3b; color: #34d399;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12.5px; flex-shrink: 0;
      box-shadow: 0 0 0 1.5px rgba(52,211,153,.3);
    }
    #hd-status-dot {
      position: absolute; bottom: -1px; right: -1px;
      width: 9px; height: 9px; border-radius: 50%;
      background: #10b981; border: 2px solid #191c21;
      transition: background .2s;
    }
    #hd-status-dot.offline { background: #94a3b8; }

    #hd-header-info {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
    }
    #hd-header-title {
      font-size: 14px; font-weight: 700; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      letter-spacing: -0.01em;
    }
    #hd-header-badge {
      background: rgba(16,185,129,.18); color: #34d399;
      font-size: 9.5px; font-weight: 600; padding: 2px 6px;
      border-radius: 5px; letter-spacing: 0.02em;
    }
    #hd-header-badge.offline {
      background: rgba(148,163,184,.18); color: #94a3b8;
    }

    #hd-header-actions {
      display: flex; align-items: center; gap: 2px;
    }
    .hd-icon-btn {
      background: none; border: none; color: #94a3b8; cursor: pointer;
      padding: 5px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      transition: color .15s, background .15s;
    }
    .hd-icon-btn:hover { color: #fff; background: rgba(255,255,255,.08); }
    .hd-icon-btn svg { width: 15px; height: 15px; }

    /* ── Connection banner ── */
    #hd-banner {
      background: #fef3c7; color: #92400e;
      font-size: 11.5px; padding: 6px 12px;
      display: none; align-items: center; gap: 6px;
      flex-shrink: 0; font-weight: 500;
    }
    #hd-banner.visible { display: flex; }
    #hd-banner.offline { background: #fee2e2; color: #991b1b; }

    /* ── Views ── */
    .hd-view { display: none; flex-direction: column; flex: 1; overflow: hidden; }
    .hd-view.active { display: flex; }

    /* ── Form view ── */
    #hd-form-view {
      padding: 20px 18px 14px; gap: 12px; overflow-y: auto; justify-content: center;
      background: #fff;
    }

    .hd-field { display: flex; flex-direction: column; gap: 5px; }
    .hd-field label {
      font-size: 12px; font-weight: 600; color: #1e293b;
    }
    .hd-field label .req { color: #ef4444; margin-left: 2px; }

    .hd-input-wrap {
      position: relative; display: flex; align-items: center;
    }
    .hd-input-icon {
      position: absolute; left: 11px; display: flex; align-items: center;
      justify-content: center; color: #94a3b8; pointer-events: none;
    }
    .hd-input-icon svg { width: 16px; height: 16px; }

    .hd-field input {
      width: 100%; border: 1.5px solid #e2e8f0; border-radius: 9px;
      padding: 9.5px 12px 9.5px 36px; font-size: 13px; font-family: inherit;
      color: #1e293b; background: #fff; outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .hd-field input:focus {
      border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.12);
    }
    .hd-field input::placeholder { color: #94a3b8; }

    #hd-form-error {
      font-size: 11.5px; color: #dc2626; display: none;
      background: #fef2f2; border: 1px solid #fee2e2;
      padding: 7px 10px; border-radius: 7px;
    }
    #hd-form-error.visible { display: block; }

    .hd-btn {
      background: #191c21; color: #fff; border: none;
      border-radius: 9px; padding: 11.5px 16px;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      transition: background .15s, transform .15s; display: flex; align-items: center;
      justify-content: center; gap: 8px; width: 100%; margin-top: 2px;
    }
    .hd-btn:hover { background: #252a32; }
    .hd-btn:disabled { opacity: .6; cursor: not-allowed; }
    .hd-btn .btn-arrow { font-size: 15px; transition: transform .15s; }
    .hd-btn:hover .btn-arrow { transform: translateX(3px); }

    .hd-form-footer {
      display: flex; align-items: center; justify-content: center; gap: 5px;
      font-size: 11px; color: #64748b; margin-top: 6px; padding-top: 4px;
    }
    .hd-form-footer svg { width: 13px; height: 13px; color: #10b981; }

    /* ── Chat view ── */
    #hd-chat-view { overflow: hidden; background: #fff; }
    #hd-messages {
      flex: 1; overflow-y: auto; padding: 14px 14px;
      display: flex; flex-direction: column; gap: 11px;
      background: #ffffff;
    }
    #hd-messages::-webkit-scrollbar { width: 4px; }
    #hd-messages::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }

    /* Date divider */
    .hd-date-divider {
      display: flex; align-items: center; justify-content: center;
      margin: 2px 0 4px;
    }
    .hd-date-divider span {
      background: #f1f5f9; color: #64748b; font-size: 10.5px;
      font-weight: 500; padding: 2px 9px; border-radius: 10px;
    }

    /* Closed notice */
    #hd-closed-notice {
      display: none; font-size: 11.5px; color: #6b7280;
      text-align: center; background: #f8fafc; border: 1px solid #edf2f7;
      border-radius: 8px; padding: 8px 10px; margin: 0 4px;
    }
    #hd-closed-notice.visible { display: block; }

    /* Message bubbles */
    .hd-msg-row {
      display: flex; flex-direction: column;
    }
    .hd-msg-row.customer { align-items: flex-end; }
    .hd-msg-row.agent { align-items: flex-start; }
    .hd-msg-row.system { align-items: center; }

    .hd-msg-agent-wrap {
      display: flex; align-items: flex-start; gap: 7px; max-width: 86%;
    }
    .hd-agent-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: #064e3b; color: #34d399;
      font-size: 10.5px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
    }
    .hd-msg-bubble-col {
      display: flex; flex-direction: column; gap: 2px;
    }

    .hd-bubble {
      padding: 9.5px 13px; border-radius: 14px;
      font-size: 13px; line-height: 1.45; word-break: break-word;
      white-space: pre-wrap;
    }
    .hd-msg-row.customer .hd-bubble {
      background: #191c21; color: #fff;
      border-bottom-right-radius: 4px;
      max-width: 84%;
    }
    .hd-msg-row.agent .hd-bubble {
      background: #fff; color: #1e293b;
      border: 1px solid #edf2f7;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
      border-top-left-radius: 4px;
    }
    .hd-msg-row.system .hd-bubble {
      background: #fef9c3; color: #713f12;
      font-size: 11px; max-width: 90%;
      border-radius: 7px; padding: 6px 10px; text-align: center;
    }

    .hd-msg-meta {
      display: flex; align-items: center; gap: 4px;
      margin-top: 2px; padding-right: 2px;
    }
    .hd-msg-time {
      font-size: 10px; color: #94a3b8;
    }
    .hd-msg-status {
      display: flex; align-items: center; gap: 2px; color: #10b981;
    }
    .hd-msg-status svg { width: 11px; height: 11px; }

    /* Failed message */
    .hd-msg-row.failed .hd-bubble {
      background: #fee2e2; color: #991b1b;
    }
    .hd-discard-btn {
      font-size: 9.5px; color: #dc2626; background: none; border: none;
      cursor: pointer; padding: 1px 4px; text-decoration: underline;
      margin-top: 1px;
    }

    /* ── Input bar ── */
    #hd-input-bar {
      display: flex; align-items: center; gap: 6px; padding: 8px 12px 3px;
      border-top: 1px solid #f1f5f9; background: #fff; flex-shrink: 0;
    }
    #hd-attach-btn {
      background: none; border: none; color: #94a3b8; cursor: pointer;
      padding: 5px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
      transition: color .15s; flex-shrink: 0;
    }
    #hd-attach-btn:hover { color: #475569; }
    #hd-attach-btn svg { width: 17px; height: 17px; }

    #hd-input {
      flex: 1; resize: none; border: 1.5px solid #f1f5f9; background: #f8fafc;
      border-radius: 18px; padding: 8px 13px;
      font-size: 13px; font-family: inherit; color: #1e293b;
      outline: none; max-height: 80px; line-height: 1.4;
      transition: border-color .15s, background .15s, box-shadow .15s;
    }
    #hd-input:focus {
      background: #fff; border-color: #10b981;
      box-shadow: 0 0 0 2.5px rgba(16,185,129,.12);
    }
    #hd-input::placeholder { color: #94a3b8; }

    #hd-send-btn {
      background: #10b981; border: none; border-radius: 50%;
      width: 32px; height: 32px; flex-shrink: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center; color: #fff;
      box-shadow: 0 2px 6px rgba(16,185,129,.3);
      transition: background .15s, transform .15s;
    }
    #hd-send-btn:hover { background: #059669; transform: scale(1.05); }
    #hd-send-btn svg { width: 15px; height: 15px; stroke-width: 2.5; }

    #hd-branding {
      font-size: 10.5px; color: #94a3b8; text-align: center;
      padding: 2px 0 6px; background: #fff; flex-shrink: 0;
    }
    #hd-branding strong { color: #64748b; font-weight: 600; }

    /* ── Spinner ── */
    .hd-spinner {
      width: 15px; height: 15px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: hd-spin .7s linear infinite;
    }
    @keyframes hd-spin { to { transform: rotate(360deg); } }
  `;
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const ICONS = {
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    <circle cx="8" cy="11.5" r="1" fill="currentColor"/>
    <circle cx="12" cy="11.5" r="1" fill="currentColor"/>
    <circle cx="16" cy="11.5" r="1" fill="currentColor"/>
  </svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>`,
  minimize: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"></line>
    <polyline points="12 5 19 12 12 19"></polyline>
  </svg>`,
  paperclip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
  </svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>`,
};

// ── HTML skeleton ─────────────────────────────────────────────────────────────

function buildSkeleton() {
  return `
    <!-- Bubble trigger -->
    <button id="hd-bubble" aria-label="Buka chat bantuan">
      ${ICONS.chat}
      <span id="hd-bubble-status" aria-hidden="true"></span>
      <span id="hd-badge" aria-label="pesan belum dibaca"></span>
    </button>

    <!-- Chat panel -->
    <div id="hd-panel" role="dialog" aria-label="Live chat" aria-modal="true">

      <!-- Header -->
      <div id="hd-header">
        <div id="hd-header-avatar">
          <span>CS</span>
          <span id="hd-status-dot" title="Status agen"></span>
        </div>
        <div id="hd-header-info">
          <span id="hd-header-title"></span>
          <span id="hd-header-badge">Online</span>
        </div>
        <div id="hd-header-actions">
          <button id="hd-min-btn" class="hd-icon-btn" aria-label="Minimalkan chat">${ICONS.minimize}</button>
          <button id="hd-close-btn" class="hd-icon-btn" aria-label="Tutup chat">${ICONS.close}</button>
        </div>
      </div>

      <!-- Connection banner -->
      <div id="hd-banner" role="status" aria-live="polite"></div>

      <!-- Form view (registration) -->
      <div id="hd-form-view" class="hd-view">
        <div class="hd-field">
          <label for="hd-name-input">Nama Lengkap <span class="req">*</span></label>
          <div class="hd-input-wrap">
            <span class="hd-input-icon">${ICONS.user}</span>
            <input id="hd-name-input" type="text" placeholder="Contoh: Rian Pratama" maxlength="100" autocomplete="name" />
          </div>
        </div>
        <div class="hd-field">
          <label for="hd-email-input">Email Bisnis <span class="req">*</span></label>
          <div class="hd-input-wrap">
            <span class="hd-input-icon">${ICONS.mail}</span>
            <input id="hd-email-input" type="email" placeholder="nama@perusahaan.com" maxlength="200" autocomplete="email" />
          </div>
        </div>
        <span id="hd-form-error" role="alert"></span>
        <button class="hd-btn" id="hd-start-btn">
          Mulai Percakapan <span class="btn-arrow">→</span>
        </button>
        <div class="hd-form-footer">
          ${ICONS.lock}
          <span>Privasi &amp; data Anda terenkripsi aman</span>
        </div>
      </div>

      <!-- Chat view -->
      <div id="hd-chat-view" class="hd-view">
        <div id="hd-messages" aria-live="polite" aria-label="Percakapan">
          <div class="hd-date-divider"><span>Hari Ini</span></div>
        </div>
        <div id="hd-closed-notice"></div>
        <div id="hd-input-bar">
          <button id="hd-attach-btn" aria-label="Lampirkan berkas" title="Lampirkan berkas">${ICONS.paperclip}</button>
          <textarea id="hd-input" rows="1" placeholder="Tulis pesan Anda..." maxlength="2000" aria-label="Pesan"></textarea>
          <button id="hd-send-btn" aria-label="Kirim pesan">${ICONS.send}</button>
        </div>
        <div id="hd-branding">
          Diberdayakan oleh <strong>Ciheul Support</strong>
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

  // Set header title (fallback to 'Ciheul Support' if default)
  const titleEl = $('#hd-header-title');
  if (titleEl) {
    const rawTitle = config.title;
    titleEl.textContent = (!rawTitle || rawTitle === 'Hubungi Kami') ? 'Ciheul Support' : rawTitle;
  }

  // Bubble click
  $('#hd-bubble').addEventListener('click', togglePanel);

  // Close & minimize button
  $('#hd-close-btn').addEventListener('click', closePanel);
  $('#hd-min-btn')?.addEventListener('click', closePanel);

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
    : `Mulai Percakapan <span class="btn-arrow">→</span>`;
}

// ── Messages rendering ────────────────────────────────────────────────────────

/** Append a single message row to the messages container */
export function appendMessage(msg) {
  const container = $('#hd-messages');
  if (!container) return;

  // Deduplicate in DOM: match by msg.id OR clientMessageId
  let existingRow = null;
  if (msg.id) {
    existingRow = _shadow.querySelector(`[data-msg-id="${msg.id}"]`);
  }
  if (!existingRow && msg.clientMessageId) {
    existingRow = _shadow.querySelector(`[data-client-id="${msg.clientMessageId}"]`);
  }

  if (existingRow) {
    // Already in DOM! Update attributes and status if needed without duplicating
    if (msg.id) existingRow.dataset.msgId = String(msg.id);
    if (msg.clientMessageId) existingRow.dataset.clientId = msg.clientMessageId;
    if (msg.status === 'sent' || msg.id) {
      existingRow.classList.remove('failed');
      const statusEl = existingRow.querySelector('.hd-msg-status');
      if (statusEl) {
        statusEl.innerHTML = `${ICONS.check}`;
      }
    }
    return;
  }

  const type = (msg.senderType || 'CUSTOMER').toLowerCase();
  const status = msg.status || 'sent'; // 'pending' | 'sent' | 'failed'

  const timeStr = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const row = document.createElement('div');
  row.classList.add('hd-msg-row', type === 'system' ? 'system' : type);
  if (status === 'failed') row.classList.add('failed');
  row.dataset.clientId = msg.clientMessageId || '';
  row.dataset.msgId = msg.id || '';

  if (type === 'agent') {
    const wrap = document.createElement('div');
    wrap.className = 'hd-msg-agent-wrap';

    const avatar = document.createElement('div');
    avatar.className = 'hd-agent-avatar';
    const senderName = msg.senderUser?.name || 'CS';
    avatar.textContent = senderName.substring(0, 2).toUpperCase();
    wrap.appendChild(avatar);

    const col = document.createElement('div');
    col.className = 'hd-msg-bubble-col';

    const bubble = document.createElement('div');
    bubble.className = 'hd-bubble';
    bubble.textContent = msg.body; // textContent prevents XSS
    col.appendChild(bubble);

    const time = document.createElement('span');
    time.className = 'hd-msg-time';
    time.textContent = timeStr;
    col.appendChild(time);

    wrap.appendChild(col);
    row.appendChild(wrap);
  } else if (type === 'customer') {
    const bubble = document.createElement('div');
    bubble.className = 'hd-bubble';
    bubble.textContent = msg.body; // textContent prevents XSS
    row.appendChild(bubble);

    const meta = document.createElement('div');
    meta.className = 'hd-msg-meta';

    const time = document.createElement('span');
    time.className = 'hd-msg-time';
    time.textContent = timeStr;
    meta.appendChild(time);

    const statusEl = document.createElement('div');
    statusEl.className = 'hd-msg-status';
    statusEl.dataset.statusFor = msg.clientMessageId || '';

    if (status === 'pending') {
      statusEl.innerHTML = `${ICONS.clock}`;
    } else if (status === 'sent') {
      statusEl.innerHTML = `${ICONS.check}`;
    } else if (status === 'failed') {
      statusEl.innerHTML = `${ICONS.warn} <span>Gagal</span>`;
      const discard = document.createElement('button');
      discard.className = 'hd-discard-btn';
      discard.textContent = 'Hapus';
      discard.addEventListener('click', () => {
        discardFailed(msg.clientMessageId);
        row.remove();
      });
      statusEl.appendChild(discard);
    }
    meta.appendChild(statusEl);
    row.appendChild(meta);
  } else {
    // System message
    const bubble = document.createElement('div');
    bubble.className = 'hd-bubble';
    bubble.textContent = msg.body;
    row.appendChild(bubble);
  }

  container.appendChild(row);
  scrollToBottom();
}

/** Render multiple messages at once */
export function renderMessages(msgs) {
  const container = $('#hd-messages');
  if (!container) return;
  container.innerHTML = '<div class="hd-date-divider"><span>Hari Ini</span></div>';
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
      statusEl.innerHTML = `${ICONS.check}`;
    } else if (status === 'failed') {
      statusEl.innerHTML = `${ICONS.warn} <span>Gagal</span>`;
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
    const inputEl = $('#hd-input');
    const sendBtn = $('#hd-send-btn');
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
  } else {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

// ── Status dot & banner ───────────────────────────────────────────────────────

export function updatePresence(agentsOnline) {
  const dot = $('#hd-status-dot');
  const bubbleDot = $('#hd-bubble-status');
  const badge = $('#hd-header-badge');

  if (agentsOnline) {
    if (dot) { dot.classList.remove('offline'); dot.title = 'Agen online'; }
    if (bubbleDot) { bubbleDot.classList.remove('offline'); }
    if (badge) { badge.textContent = 'Online'; badge.classList.remove('offline'); }
  } else {
    if (dot) { dot.classList.add('offline'); dot.title = 'Agen offline'; }
    if (bubbleDot) { bubbleDot.classList.add('offline'); }
    if (badge) { badge.textContent = 'Offline'; badge.classList.add('offline'); }
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
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
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
  on('connection:status', (status) => {
    updateConnectionBanner(status);
  });

  on('message:new', ({ message }) => {
    appendMessage(message);
  });

  on('messages:synced', (msgs) => {
    for (const m of msgs) appendMessage(m);
  });

  on('message:confirmed', ({ clientMessageId, message }) => {
    updateMessageStatus(clientMessageId, 'sent', message);
  });

  on('message:failed', ({ clientMessageId }) => {
    updateMessageStatus(clientMessageId, 'failed');
  });

  on('presence:update', ({ agentsOnline }) => {
    updatePresence(agentsOnline);
  });

  on('ticket:updated', (ticket) => {
    if (ticket.status === 'CLOSED') {
      showClosedNotice(true);
    }
  });

  on('unread:changed', (count) => {
    updateBadge(count);
  });
}
