import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

const TOKEN_KEY = 'codearmor_token';
const USER_KEY  = 'codearmor_user';

interface AuthUser { id: string; username: string; role: string }

function isTokenExpired(token: string): boolean {
  try {
    // Client-side only — purely for UX (redirect before 401 hits the server)
    // NOT a security check — the server always verifies with jwt.verify()
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser  = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser && !isTokenExpired(storedToken)) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    setIsAuthenticated(true);
    return result;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

  return { isAuthenticated, user, token, loading, login, logout };
}
