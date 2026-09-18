import crypto from 'crypto';
import { TokenResponse } from './types';

export const SILPO_ISSUER = 'https://mcp.silpo.ua';
export const SILPO_MCP_URL = `${SILPO_ISSUER}/mcp`;
const TOKEN_TIMEOUT_MS = 15_000;

export function getSilpoClientId(): string | null {
  return process.env.SILPO_MCP_CLIENT_ID || null;
}

/** Feature flag: the whole integration is hidden unless both secrets exist. */
export function isSilpoEnabled(): boolean {
  return Boolean(getSilpoClientId() && process.env.SILPO_TOKEN_ENC_KEY);
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL is missing');
  return url.replace(/\/$/, '');
}

export function getRedirectUri(): string {
  return `${getAppUrl()}/api/silpo/callback`;
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generatePkce(): { verifier: string; challenge: string; state: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return {
    verifier,
    challenge: pkceChallenge(verifier),
    state: crypto.randomBytes(16).toString('base64url'),
  };
}

export function buildAuthorizeUrl(params: {
  clientId: string; redirectUri: string; challenge: string; state: string;
}): string {
  const u = new URL(`${SILPO_ISSUER}/authorize`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', params.clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('code_challenge', params.challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('state', params.state);
  u.searchParams.set('resource', SILPO_ISSUER);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${SILPO_ISSUER}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!res.ok || typeof json.access_token !== 'string') {
    throw new Error(`Silpo token endpoint ${res.status}: ${json.error ?? 'unknown error'}`);
  }
  return json as TokenResponse;
}

export function exchangeCode(input: {
  code: string; verifier: string; clientId: string; redirectUri: string;
}): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.verifier,
    resource: SILPO_ISSUER,
  });
}

export function refreshAccessToken(input: { refreshToken: string; clientId: string }): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    resource: SILPO_ISSUER,
  });
}

/** Best-effort: the metadata advertises `/token` as the revocation endpoint. */
export async function revokeToken(token: string, clientId: string): Promise<void> {
  try {
    await fetch(`${SILPO_ISSUER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, client_id: clientId }).toString(),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    // ignore: disconnect must succeed locally regardless
  }
}
