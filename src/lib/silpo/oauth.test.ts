import { describe, it, expect, vi, afterEach } from 'vitest';
import { pkceChallenge, buildAuthorizeUrl, exchangeCode, refreshAccessToken, isSilpoEnabled } from './oauth';

describe('pkceChallenge', () => {
  it('matches the RFC 7636 appendix B vector', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('buildAuthorizeUrl', () => {
  it('includes all required OAuth params', () => {
    const url = new URL(buildAuthorizeUrl({
      clientId: 'cid', redirectUri: 'http://localhost:3000/api/silpo/callback', challenge: 'ch', state: 'st',
    }));
    expect(url.origin + url.pathname).toBe('https://mcp.silpo.ua/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/silpo/callback');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe('st');
    expect(url.searchParams.get('resource')).toBe('https://mcp.silpo.ua');
  });
});

describe('token endpoint', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('exchangeCode posts the authorization_code grant and returns tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'a', token_type: 'Bearer', expires_in: 100, refresh_token: 'r',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const tokens = await exchangeCode({ code: 'c', verifier: 'v', clientId: 'cid', redirectUri: 'http://x/cb' });

    expect(tokens.access_token).toBe('a');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://mcp.silpo.ua/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('c');
    expect(body.get('code_verifier')).toBe('v');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('redirect_uri')).toBe('http://x/cb');
  });

  it('refreshAccessToken posts the refresh_token grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'a2', token_type: 'Bearer', expires_in: 100,
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshAccessToken({ refreshToken: 'r', clientId: 'cid' });

    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('r');
  });

  it('throws on a non-2xx token response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));
    await expect(refreshAccessToken({ refreshToken: 'r', clientId: 'cid' })).rejects.toThrow(/invalid_grant/);
  });
});

describe('isSilpoEnabled', () => {
  it('requires both client id and encryption key', () => {
    const saved = { id: process.env.SILPO_MCP_CLIENT_ID, key: process.env.SILPO_TOKEN_ENC_KEY };
    delete process.env.SILPO_MCP_CLIENT_ID;
    process.env.SILPO_TOKEN_ENC_KEY = 'k';
    expect(isSilpoEnabled()).toBe(false);
    process.env.SILPO_MCP_CLIENT_ID = 'cid';
    expect(isSilpoEnabled()).toBe(true);
    process.env.SILPO_MCP_CLIENT_ID = saved.id;
    process.env.SILPO_TOKEN_ENC_KEY = saved.key;
  });
});
