/**
 * src/api.js
 * REST client for widget endpoints.
 * All requests use the server origin from config.
 */

import { config } from './config.js';

const BASE = `${config.server}/api/widget`;

/**
 * POST /api/widget/session
 * Creates or updates a customer session.
 * @param {{ name: string, email?: string, visitorToken?: string }} body
 * @returns {{ visitorToken: string, customer: object }}
 */
export async function postSession(body) {
  const res = await fetch(`${BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err?.error?.message || 'Gagal memulai sesi'), {
      status: res.status,
      code: err?.error?.code,
    });
  }
  const { data } = await res.json();
  return data;
}

/**
 * GET /api/widget/conversation?after=<id>
 * Fetches customer conversation (ticket + messages).
 * @param {string} visitorToken
 * @param {number|null} after  — only fetch messages after this id
 * @returns {{ customer: object, ticket: object|null, messages: object[] }}
 */
export async function getConversation(visitorToken, after = null) {
  const url = new URL(`${BASE}/conversation`);
  if (after) url.searchParams.set('after', after);

  const res = await fetch(url.toString(), {
    headers: { 'X-Visitor-Token': visitorToken },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(
      new Error(err?.error?.message || 'Gagal memuat percakapan'),
      { status: res.status, code: err?.error?.code }
    );
  }
  const { data } = await res.json();
  return data;
}
