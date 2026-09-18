import { SILPO_MCP_URL, getSilpoClientId, refreshAccessToken } from './oauth';
import { decryptTokens, getConnection, markExpired, saveTokens } from './connections';
import { SilpoAuthError, SilpoNotConnectedError, SilpoRateLimitError, SilpoToolError } from './types';

const REFRESH_SKEW_MS = 5 * 60 * 1000;
const CALL_TIMEOUT_MS = 20_000;

export interface RpcResponse {
  result?: { isError?: boolean; content?: Array<{ type: string; text?: string }> };
  error?: { code: number; message: string };
}

/** The server answers either with plain JSON or with an SSE stream; take the last `data:` frame. */
export function parseRpcBody(text: string): RpcResponse {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as RpcResponse;
  const frames = trimmed.split('\n').filter((l) => l.startsWith('data:'));
  if (frames.length === 0) throw new SilpoToolError('Empty MCP response');
  return JSON.parse(frames[frames.length - 1].slice(5).trim()) as RpcResponse;
}

export function extractToolPayload<T>(rpc: RpcResponse): T {
  if (rpc.error) throw new SilpoToolError(rpc.error.message);
  const text = (rpc.result?.content ?? []).map((c) => c.text ?? '').join('\n');
  if (rpc.result?.isError) throw new SilpoToolError(text || 'Tool error');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SilpoToolError(`Non-JSON tool payload: ${text.slice(0, 200)}`);
  }
}

async function rawToolCall(
  accessToken: string, name: string, args: Record<string, unknown>,
): Promise<{ status: number; body: string }> {
  const res = await fetch(SILPO_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  return { status: res.status, body: await res.text() };
}

async function ensureFreshToken(userEmail: string, force = false): Promise<string> {
  const conn = await getConnection(userEmail);
  if (!conn) throw new SilpoNotConnectedError();
  if (conn.status === 'expired') throw new SilpoAuthError();
  const { accessToken, refreshToken } = decryptTokens(conn);
  const stale = force || new Date(conn.expiresAt).getTime() - REFRESH_SKEW_MS < Date.now();
  if (!stale) return accessToken;
  if (!refreshToken) {
    await markExpired(userEmail);
    throw new SilpoAuthError('No refresh token');
  }
  try {
    const tokens = await refreshAccessToken({ refreshToken, clientId: getSilpoClientId() ?? '' });
    await saveTokens(userEmail, tokens);
    return tokens.access_token;
  } catch {
    await markExpired(userEmail);
    throw new SilpoAuthError('Token refresh failed');
  }
}

/** Calls one MCP tool for the user and returns its JSON payload. */
export async function callTool<T>(
  userEmail: string, name: string, args: Record<string, unknown> = {},
): Promise<T> {
  let token = await ensureFreshToken(userEmail);
  let { status, body } = await rawToolCall(token, name, args);
  if (status === 401) {
    token = await ensureFreshToken(userEmail, true);
    ({ status, body } = await rawToolCall(token, name, args));
    if (status === 401) {
      await markExpired(userEmail);
      throw new SilpoAuthError();
    }
  }
  if (status === 429) throw new SilpoRateLimitError();
  if (status >= 500) throw new SilpoToolError(`Silpo MCP responded ${status}`);
  return extractToolPayload<T>(parseRpcBody(body));
}
