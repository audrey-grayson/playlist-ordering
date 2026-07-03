// Spotify Authorization Code + PKCE flow. No client secret required, so this
// is safe to run entirely in the browser.

import { config } from '../config';
import { randomString, sha256Challenge } from './pkce';
import {
  tokenStore,
  isTokenValid,
  type StoredToken,
} from './tokenStore';

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

function toStored(res: TokenResponse, prevRefresh: string | null): StoredToken {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token ?? prevRefresh,
    expiresAt: Date.now() + res.expires_in * 1000,
    scope: res.scope,
  };
}

/** Kick off login: build the authorize URL and redirect the browser to it. */
export async function beginLogin(): Promise<void> {
  const verifier = randomString(64);
  const challenge = await sha256Challenge(verifier);
  const state = randomString(16);

  tokenStore.setVerifier(verifier);
  tokenStore.setState(state);

  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: 'code',
    redirect_uri: config.spotify.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: config.spotify.scopes.join(' '),
    state,
  });

  window.location.assign(`${config.spotify.authBase}/authorize?${params}`);
}

/**
 * Handle the redirect back from Spotify. Reads ?code & ?state from the URL,
 * exchanges the code for tokens, stores them, and returns the token.
 * Throws on state mismatch or error.
 */
export async function completeLogin(search: string): Promise<StoredToken> {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  if (error) throw new Error(`Spotify authorization failed: ${error}`);

  const code = params.get('code');
  const state = params.get('state');
  const expectedState = tokenStore.takeState();
  const verifier = tokenStore.takeVerifier();

  if (!code) throw new Error('Missing authorization code in callback.');
  if (!state || state !== expectedState)
    throw new Error('OAuth state mismatch — possible CSRF, aborting.');
  if (!verifier) throw new Error('Missing PKCE verifier (session lost?).');

  const body = new URLSearchParams({
    client_id: config.spotify.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.spotify.redirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`${config.spotify.authBase}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  const token = toStored((await res.json()) as TokenResponse, null);
  tokenStore.set(token);
  return token;
}

/** Refresh the access token using the stored refresh token. */
export async function refreshToken(): Promise<StoredToken> {
  const current = tokenStore.get();
  const rt = current?.refreshToken;
  if (!rt) throw new Error('No refresh token available.');

  const body = new URLSearchParams({
    client_id: config.spotify.clientId,
    grant_type: 'refresh_token',
    refresh_token: rt,
  });

  const res = await fetch(`${config.spotify.authBase}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    tokenStore.clear();
    throw new Error(`Token refresh failed (${res.status}).`);
  }
  const token = toStored((await res.json()) as TokenResponse, rt);
  tokenStore.set(token);
  return token;
}

/**
 * Return a valid access token, refreshing if needed. Throws if the user is not
 * logged in / cannot be refreshed.
 */
export async function getValidAccessToken(): Promise<string> {
  const current = tokenStore.get();
  if (current && isTokenValid(current)) return current.accessToken;
  if (current?.refreshToken) {
    const refreshed = await refreshToken();
    return refreshed.accessToken;
  }
  throw new Error('Not authenticated.');
}

export function logout(): void {
  tokenStore.clear();
}

export function isLoggedIn(): boolean {
  const t = tokenStore.get();
  if (!t) return false;
  return isTokenValid(t) || Boolean(t.refreshToken);
}
