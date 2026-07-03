// Persistent token storage in localStorage, plus the transient PKCE verifier
// and OAuth state used across the redirect.

export interface StoredToken {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  scope: string;
}

const TOKEN_KEY = 'spo.token';
const VERIFIER_KEY = 'spo.pkce_verifier';
const STATE_KEY = 'spo.oauth_state';

export const tokenStore = {
  get(): StoredToken | null {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredToken;
    } catch {
      return null;
    }
  },
  set(token: StoredToken): void {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  setVerifier(v: string): void {
    sessionStorage.setItem(VERIFIER_KEY, v);
  },
  takeVerifier(): string | null {
    const v = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    return v;
  },

  setState(s: string): void {
    sessionStorage.setItem(STATE_KEY, s);
  },
  takeState(): string | null {
    const s = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    return s;
  },
};

/** True if the token is present and not within 30s of expiry. */
export function isTokenValid(token: StoredToken | null): boolean {
  return Boolean(token && token.expiresAt - 30_000 > Date.now());
}
