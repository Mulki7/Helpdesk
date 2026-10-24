/**
 * src/api/client.js
 * Centralized REST client with automatic in-memory access token management
 * and single-flight refresh token rotation on HTTP 401.
 */

const REFRESH_TOKEN_KEY = 'hd_refresh_token';
const BASE_URL = '/api';

let _accessToken = null;
let _refreshPromise = null;
let _onAuthFailure = null;

export function setAccessToken(token) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token) {
  if (token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearAuthTokens() {
  _accessToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function registerAuthFailureHandler(callback) {
  _onAuthFailure = callback;
}

/**
 * Perform token refresh request (single-flight promise)
 */
export async function refreshAccessToken() {
  if (_refreshPromise) {
    return _refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    if (_onAuthFailure) _onAuthFailure();
    throw new Error('Email dan password salah.');
  }

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearAuthTokens();
        if (_onAuthFailure) _onAuthFailure();
        throw new Error('Refresh token kedaluwarsa atau tidak valid.');
      }

      const json = await res.json();
      const { accessToken, refreshToken: newRefreshToken, user } = json.data;

      setAccessToken(accessToken);
      if (newRefreshToken) {
        setRefreshToken(newRefreshToken);
      }

      return { accessToken, refreshToken: newRefreshToken || refreshToken, user };
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

/**
 * Authenticated fetch client with automatic token refresh on 401
 */
export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (_accessToken) {
    headers.set('Authorization', `Bearer ${_accessToken}`);
  }

  let res = await fetch(url, { ...options, headers });

  // If 401 Unauthorized, attempt refresh once and retry
  if (res.status === 401 && !options._isRetry) {
    try {
      const { accessToken } = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${accessToken}`);
      res = await fetch(url, { ...options, headers, _isRetry: true });
    } catch (err) {
      // Refresh failed — clear session and throw
      clearAuthTokens();
      if (_onAuthFailure) _onAuthFailure();
      throw err;
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.error?.message || `Request gagal (${res.status})`);
    error.status = res.status;
    error.code = data?.error?.code;
    error.details = data?.error?.details;
    throw error;
  }

  return data;
}
