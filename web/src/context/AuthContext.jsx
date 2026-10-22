import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth.js';
import {
  getRefreshToken,
  refreshAccessToken,
  registerAuthFailureHandler,
  clearAuthTokens,
} from '../api/client.js';
import { initSocket, disconnectSocket } from '../socket/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(async () => {
    disconnectSocket();
    await authApi.logout();
    setUser(null);
  }, []);

  // Listen to 401 refresh failure
  useEffect(() => {
    registerAuthFailureHandler(() => {
      disconnectSocket();
      setUser(null);
    });
  }, []);

  // Restore session on mount if refresh token exists
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { user: refreshedUser } = await refreshAccessToken();
        if (mounted) {
          setUser(refreshedUser);
          initSocket();
        }
      } catch (err) {
        clearAuthTokens();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = async (email, password) => {
    const { user: loggedInUser } = await authApi.login(email, password);
    setUser(loggedInUser);
    initSocket();
    return loggedInUser;
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    login: handleLogin,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
