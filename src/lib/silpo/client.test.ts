import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SilpoAuthError, SilpoToolError, SilpoRateLimitError } from './types';

vi.mock('./connections', () => ({
  getConnection: vi.fn(),
  saveTokens: vi.fn(),
  markExpired: vi.fn(),
  decryptTokens: vi.fn(),
}));
vi.mock('./oauth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./oauth')>()),
  refreshAccessToken: vi.fn(),
  getSilpoClientId: () => 'cid',
}));

import { callTool, parseRpcBody, extractToolPayload } from './client';
import * as connections from './connections';
import * as oauth from './oauth';

const rpcOk = (payload: unknown) => JSON.stringify({
  jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
});

function activeConn(expiresInMs = 60 * 60 * 1000) {
  return {
    userEmail: 'u@x', accessTokenEnc: 'e', refreshTokenEnc: 'r', scope: null, status: 'active' as const,
    expiresAt: new Date(Date.now() + expiresInMs), connectedAt: new Date(), updatedAt: new Date(),
  };
}

describe('parseRpcBody', () => {
  it('parses plain JSON', () => {
    expect(parseRpcBody(rpcOk({ a: 1 })).result?.content?.[0].text).toBe('{"a":1}');
  });
  it('parses the last SSE data frame', () => {
    const sse = `event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\\"b\\":2}"}]}}\n\n`;
    expect(parseRpcBody(sse).result?.content?.[0].text).toBe('{"b":2}');
  });
});

describe('extractToolPayload', () => {
  it('throws SilpoToolError on isError', () => {
    expect(() => extractToolPayload({ result: { isError: true, content: [{ type: 'text', text: 'boom' }] } }))
      .toThrow(SilpoToolError);
  });
  it('throws on JSON-RPC error', () => {
    expect(() => extractToolPayload({ error: { code: -32601, message: 'nope' } })).toThrow(/nope/);
  });
});

describe('callTool', () => {
  beforeEach(() => {
    vi.mocked(connections.decryptTokens).mockReturnValue({ accessToken: 'old', refreshToken: 'ref' });
    vi.mocked(connections.getConnection).mockResolvedValue(activeConn());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('returns the parsed tool payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(rpcOk({ ok: true }), { status: 200 })));
    await expect(callTool('u@x', 'silpo_get_my_shopping_cart')).resolves.toEqual({ ok: true });
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(rpcOk({ ok: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(oauth.refreshAccessToken).mockResolvedValue({ access_token: 'new', token_type: 'Bearer', expires_in: 100 });

    await expect(callTool('u@x', 'x')).resolves.toEqual({ ok: 1 });
    expect(connections.saveTokens).toHaveBeenCalledWith('u@x', expect.objectContaining({ access_token: 'new' }));
    expect((fetchMock.mock.calls[1][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new' });
  });

  it('marks the connection expired when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    vi.mocked(oauth.refreshAccessToken).mockRejectedValue(new Error('invalid_grant'));
    await expect(callTool('u@x', 'x')).rejects.toBeInstanceOf(SilpoAuthError);
    expect(connections.markExpired).toHaveBeenCalledWith('u@x');
  });

  it('proactively refreshes a token that expires within 5 minutes', async () => {
    vi.mocked(connections.getConnection).mockResolvedValue(activeConn(60 * 1000));
    vi.mocked(oauth.refreshAccessToken).mockResolvedValue({ access_token: 'fresh', token_type: 'Bearer', expires_in: 100 });
    const fetchMock = vi.fn().mockResolvedValue(new Response(rpcOk({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await callTool('u@x', 'x');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer fresh' });
  });

  it('throws SilpoRateLimitError on 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(callTool('u@x', 'x')).rejects.toBeInstanceOf(SilpoRateLimitError);
  });
});
