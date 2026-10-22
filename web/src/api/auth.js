import { request, setAccessToken, setRefreshToken, clearAuthTokens, getRefreshToken } from './client.js';

export async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const { accessToken, refreshToken, user } = res.data;
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);

  return { user, accessToken };
}

export async function logout() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Ignore network error on logout
  } finally {
    clearAuthTokens();
  }
}

export async function getMe() {
  const res = await request('/auth/me', {
    method: 'GET',
  });
  return res.data;
}
