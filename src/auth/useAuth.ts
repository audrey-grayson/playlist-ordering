import { useCallback, useEffect, useState } from 'react';
import {
  beginLogin,
  completeLogin,
  isLoggedIn as checkLoggedIn,
  logout as doLogout,
} from './spotifyAuth';

export interface AuthState {
  loggedIn: boolean;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
}

/**
 * Auth hook. On mount, if the current URL is the OAuth callback (has ?code),
 * it completes the token exchange and cleans the URL.
 */
export function useAuth(): AuthState {
  const [loggedIn, setLoggedIn] = useState<boolean>(() => checkLoggedIn());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isCallback = params.has('code') || params.has('error');
    if (!isCallback) return;

    setLoading(true);
    completeLogin(window.location.search)
      .then(() => {
        setLoggedIn(true);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setLoading(false);
        // Strip auth params from the URL without a reload.
        window.history.replaceState({}, '', window.location.pathname);
      });
  }, []);

  const login = useCallback(() => {
    setError(null);
    beginLogin().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  const logout = useCallback(() => {
    doLogout();
    setLoggedIn(false);
  }, []);

  return { loggedIn, loading, error, login, logout };
}
