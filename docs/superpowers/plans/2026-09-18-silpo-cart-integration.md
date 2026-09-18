# Silpo Cart Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Sytno user connect their Silpo account once and push their shopping list into their Silpo cart (for their city/branch) after previewing matched products and prices.

**Architecture:** A server-only `src/lib/silpo/` package talks to the Silpo MCP server (`https://mcp.silpo.ua/mcp`, JSON-RPC over HTTP) with per-user OAuth tokens stored encrypted in MongoDB. Thin Next.js route handlers under `/api/silpo/*` expose connect/status/match/add. Two UI entry points: a profile section to connect, and an order button + bottom sheet on `/shopping-list`.

**Tech Stack:** Next.js 15 App Router route handlers, MongoDB driver, node:crypto (PKCE, AES-256-GCM), OpenAI `gpt-4.1-mini` for candidate ranking, Vitest, Tailwind 4 brand tokens.

Spec: `docs/superpowers/specs/2026-09-18-silpo-cart-integration-design.md`.

## Global Constraints

- Feature flag: everything renders/works only when `SILPO_MCP_CLIENT_ID` **and** `SILPO_TOKEN_ENC_KEY` are set (`isSilpoEnabled()`).
- Silpo tokens never reach the client; all Silpo calls are server-side. Env keys have no `NEXT_PUBLIC_` prefix.
- Product search requires a **fresh available timeslot**; an expired slot yields 0 products silently. Always go through `resolveCartContext` before searching or adding.
- Weighted products (`weighted: true`): `step` and `quantity` are in **kilograms**.
- `silpo_add_or_update_cart_products` without `addQuantity` **replaces** the quantity.
- Do NOT modify `shoppingListBuilder.ts`, `ShoppingListItem`, or `/api/shopping-list` behaviour.
- Only the word «Сільпо» in UI, no logo. Brand tokens: sage/terracotta/cream, `rounded-2xl`, `shadow-soft`; no orange.
- Type-check with `npx tsc --noEmit`, never `next build` while `next dev` runs.
- Tests: Vitest, files `src/**/*.test.ts`, run with `npm test` (or `npx vitest run <path>`).
- Commit after each task. Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/silpo/types.ts` | Shared types + error classes |
| `src/lib/silpo/crypto.ts` | AES-256-GCM encrypt/decrypt of secrets |
| `src/lib/silpo/oauth.ts` | Env/flag, PKCE, authorize URL, token exchange/refresh/revoke |
| `src/lib/silpo/connections.ts` | Mongo repo: `silpo_connections`, `silpo_oauth_states` |
| `src/lib/silpo/client.ts` | `callTool()` JSON-RPC client with refresh-on-401 |
| `src/lib/silpo/quantity.ts` | Pure unit parsing + pack/kg computation |
| `src/lib/silpo/cartContext.ts` | Resolve user's cart, refresh timeslot |
| `src/lib/silpo/setupCart.ts` | Address → delivery options → create cart |
| `src/lib/silpo/matchProducts.ts` | Batch search + LLM ranking → `SilpoMatch[]` |
| `src/lib/silpo/apiErrors.ts` | Map Silpo errors to HTTP responses |
| `src/app/api/silpo/{connect,callback,status,connection}/route.ts` | OAuth + connection endpoints |
| `src/app/api/silpo/cart/{options,create,add}/route.ts`, `src/app/api/silpo/match/route.ts` | Cart/match endpoints |
| `src/hooks/useSilpoConnection.ts` | Client status hook |
| `src/components/profilePage/SilpoConnectSettings.tsx` | Profile section |
| `src/components/shoppingListPage/SilpoOrderButton.tsx`, `SilpoOrderSheet.tsx` | Shopping list UI |
| `scripts/silpo-register-client.mjs` | One-off DCR per environment |

---

### Task 1: Types, error classes, secret encryption

**Files:**
- Create: `src/lib/silpo/types.ts`
- Create: `src/lib/silpo/crypto.ts`
- Test: `src/lib/silpo/crypto.test.ts`

**Interfaces:**
- Produces: all types below; `encryptSecret(plain: string): string`, `decryptSecret(payload: string): string`.

- [ ] **Step 1: Write types**

```ts
// src/lib/silpo/types.ts
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface SilpoConnectionDoc {
  userEmail: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date;
  scope: string | null;
  status: 'active' | 'expired';
  connectedAt: Date;
  updatedAt: Date;
}

export interface SilpoProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  available: boolean;
  image: string | null;
  weighted: boolean;
  step: number;
  displayRatio: string | null;
  companyId: string;
  branchId: string;
  externalProductId: number;
}

export interface SilpoTimeslot {
  start: string;
  end: string;
}

export interface SilpoCartContext {
  cartId: string;
  branchId: string;
  companyId: string;
  /** Delivery type to use for searches (Express is mapped to DeliveryHome). */
  deliveryType: string;
  timeslot: SilpoTimeslot;
  minOrderCost: number | null;
  address: { city: string | null; street: string | null };
}

export type CartContextResult =
  | { kind: 'ready'; ctx: SilpoCartContext }
  | { kind: 'no-cart' };

export interface SilpoMatch {
  itemId: string;
  itemName: string;
  itemQuantity: number;
  itemUnit: string;
  product: SilpoProduct;
  alternatives: SilpoProduct[];
  /** Packs for piece goods, kilograms for weighted goods. */
  quantity: number;
  approximate: boolean;
  lineTotal: number;
}

export interface SilpoUnmatched {
  itemId: string;
  name: string;
}

export interface SilpoValidation {
  level: string;
  type: string;
  message: string;
  context: unknown;
}

export interface SilpoAddResult {
  totalAfterDiscounts: number;
  minOrderCost: number | null;
  validations: SilpoValidation[];
  checkoutWebLink: string | null;
  checkoutMobileLink: string | null;
}

export class SilpoNotConnectedError extends Error {
  constructor() { super('Silpo is not connected'); this.name = 'SilpoNotConnectedError'; }
}
export class SilpoAuthError extends Error {
  constructor(message = 'Silpo authorization expired') { super(message); this.name = 'SilpoAuthError'; }
}
export class SilpoRateLimitError extends Error {
  constructor() { super('Silpo rate limit'); this.name = 'SilpoRateLimitError'; }
}
export class SilpoToolError extends Error {
  constructor(message: string) { super(message); this.name = 'SilpoToolError'; }
}
```

- [ ] **Step 2: Write the failing crypto test**

```ts
// src/lib/silpo/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { encryptSecret, decryptSecret } from './crypto';

describe('silpo crypto', () => {
  beforeAll(() => {
    process.env.SILPO_TOKEN_ENC_KEY = crypto.randomBytes(32).toString('base64');
  });

  it('round-trips a secret', () => {
    const enc = encryptSecret('my-token');
    expect(enc).not.toContain('my-token');
    expect(decryptSecret(enc)).toBe('my-token');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('rejects tampered payloads', () => {
    const enc = encryptSecret('secret');
    const [iv, tag, data] = enc.split('.');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });

  it('throws when the key is missing', () => {
    const saved = process.env.SILPO_TOKEN_ENC_KEY;
    delete process.env.SILPO_TOKEN_ENC_KEY;
    expect(() => encryptSecret('x')).toThrow(/SILPO_TOKEN_ENC_KEY/);
    process.env.SILPO_TOKEN_ENC_KEY = saved;
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/silpo/crypto.test.ts`
Expected: FAIL (cannot resolve `./crypto`).

- [ ] **Step 4: Implement crypto**

```ts
// src/lib/silpo/crypto.ts
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.SILPO_TOKEN_ENC_KEY;
  if (!raw) throw new Error('SILPO_TOKEN_ENC_KEY is missing');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SILPO_TOKEN_ENC_KEY must decode to 32 bytes');
  return key;
}

/** Returns `iv.tag.ciphertext`, each part base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted payload');
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `npx vitest run src/lib/silpo/crypto.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/silpo/types.ts src/lib/silpo/crypto.ts src/lib/silpo/crypto.test.ts
git commit -m "feat(silpo): types and AES-GCM secret encryption"
```

---

### Task 2: OAuth helpers (PKCE, authorize URL, token endpoint)

**Files:**
- Create: `src/lib/silpo/oauth.ts`
- Test: `src/lib/silpo/oauth.test.ts`

**Interfaces:**
- Produces: `SILPO_ISSUER`, `SILPO_MCP_URL`, `getSilpoClientId(): string | null`, `isSilpoEnabled(): boolean`, `getAppUrl(): string`, `getRedirectUri(): string`, `pkceChallenge(verifier): string`, `generatePkce(): { verifier; challenge; state }`, `buildAuthorizeUrl({ clientId, redirectUri, challenge, state }): string`, `exchangeCode({ code, verifier, clientId, redirectUri }): Promise<TokenResponse>`, `refreshAccessToken({ refreshToken, clientId }): Promise<TokenResponse>`, `revokeToken(token, clientId): Promise<void>`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/silpo/oauth.test.ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/silpo/oauth.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/oauth.ts
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
    // ignore — disconnect must succeed locally regardless
  }
}
```

- [ ] **Step 4: Run tests → PASS**

Run: `npx vitest run src/lib/silpo/oauth.test.ts` → 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/oauth.ts src/lib/silpo/oauth.test.ts
git commit -m "feat(silpo): OAuth PKCE helpers and token endpoint client"
```

---

### Task 3: Connection repository + indexes

**Files:**
- Create: `src/lib/silpo/connections.ts`
- Modify: `src/lib/ensureIndexes.ts` (add 3 specs at end of `INDEXES`)

**Interfaces:**
- Produces: `getConnection(userEmail): Promise<SilpoConnectionDoc | null>`, `saveTokens(userEmail, tokens: TokenResponse): Promise<void>`, `decryptTokens(conn): { accessToken: string; refreshToken: string | null }`, `markExpired(userEmail)`, `deleteConnection(userEmail)`, `createOauthState({ state, userEmail, verifier, returnTo })`, `consumeOauthState(state): Promise<{ userEmail; verifier; returnTo } | null>`.

- [ ] **Step 1: Implement repository**

```ts
// src/lib/silpo/connections.ts
import { getDb } from '@/lib/db';
import { decryptSecret, encryptSecret } from './crypto';
import { SilpoConnectionDoc, TokenResponse } from './types';

const CONNECTIONS = 'silpo_connections';
const STATES = 'silpo_oauth_states';

interface OauthStateDoc {
  state: string;
  userEmail: string;
  verifierEnc: string;
  returnTo: string;
  createdAt: Date;
}

export async function getConnection(userEmail: string): Promise<SilpoConnectionDoc | null> {
  const db = await getDb();
  return db.collection(CONNECTIONS).findOne<SilpoConnectionDoc>({ userEmail }, { projection: { _id: 0 } });
}

/** Upserts tokens. A refresh response without `refresh_token` keeps the old one. */
export async function saveTokens(userEmail: string, tokens: TokenResponse): Promise<void> {
  const now = new Date();
  const ttlSec = Number.isFinite(tokens.expires_in) ? Math.max(60, tokens.expires_in) : 3600;
  const $set: Record<string, unknown> = {
    accessTokenEnc: encryptSecret(tokens.access_token),
    expiresAt: new Date(now.getTime() + ttlSec * 1000),
    scope: tokens.scope ?? null,
    status: 'active',
    updatedAt: now,
  };
  if (tokens.refresh_token) $set.refreshTokenEnc = encryptSecret(tokens.refresh_token);

  const db = await getDb();
  await db.collection(CONNECTIONS).updateOne(
    { userEmail },
    { $set, $setOnInsert: { userEmail, connectedAt: now, ...(tokens.refresh_token ? {} : { refreshTokenEnc: null }) } },
    { upsert: true },
  );
}

export function decryptTokens(conn: SilpoConnectionDoc): { accessToken: string; refreshToken: string | null } {
  return {
    accessToken: decryptSecret(conn.accessTokenEnc),
    refreshToken: conn.refreshTokenEnc ? decryptSecret(conn.refreshTokenEnc) : null,
  };
}

export async function markExpired(userEmail: string): Promise<void> {
  const db = await getDb();
  await db.collection(CONNECTIONS).updateOne({ userEmail }, { $set: { status: 'expired', updatedAt: new Date() } });
}

export async function deleteConnection(userEmail: string): Promise<void> {
  const db = await getDb();
  await db.collection(CONNECTIONS).deleteOne({ userEmail });
}

export async function createOauthState(input: {
  state: string; userEmail: string; verifier: string; returnTo: string;
}): Promise<void> {
  const db = await getDb();
  const doc: OauthStateDoc = {
    state: input.state,
    userEmail: input.userEmail,
    verifierEnc: encryptSecret(input.verifier),
    returnTo: input.returnTo,
    createdAt: new Date(),
  };
  await db.collection(STATES).insertOne(doc);
}

/** One-shot: deletes the state so a code can't be replayed. */
export async function consumeOauthState(
  state: string,
): Promise<{ userEmail: string; verifier: string; returnTo: string } | null> {
  const db = await getDb();
  const doc = await db.collection(STATES).findOneAndDelete({ state }) as OauthStateDoc | null;
  if (!doc) return null;
  return { userEmail: doc.userEmail, verifier: decryptSecret(doc.verifierEnc), returnTo: doc.returnTo };
}
```

- [ ] **Step 2: Add indexes** — append to `INDEXES` in `src/lib/ensureIndexes.ts` before the closing `];`:

```ts
  // --- Silpo integration ---------------------------------------------------
  { collection: 'silpo_connections', keys: { userEmail: 1 }, options: { unique: true } },
  { collection: 'silpo_oauth_states', keys: { state: 1 }, options: { unique: true } },
  // Pending OAuth states die after 10 minutes.
  { collection: 'silpo_oauth_states', keys: { createdAt: 1 }, options: { expireAfterSeconds: 600 } },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` → exit 0. (If `findOneAndDelete` typing complains, cast: `(await db.collection<OauthStateDoc>(STATES).findOneAndDelete({ state }))`.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/silpo/connections.ts src/lib/ensureIndexes.ts
git commit -m "feat(silpo): encrypted connection repository and oauth state store"
```

---

### Task 4: MCP tool-call client with refresh-on-401

**Files:**
- Create: `src/lib/silpo/client.ts`
- Test: `src/lib/silpo/client.test.ts`

**Interfaces:**
- Consumes: `getConnection`, `saveTokens`, `markExpired`, `decryptTokens` (Task 3); `refreshAccessToken`, `getSilpoClientId`, `SILPO_MCP_URL` (Task 2).
- Produces: `callTool<T>(userEmail: string, name: string, args?: Record<string, unknown>): Promise<T>`, plus pure `parseRpcBody(text): RpcResponse`, `extractToolPayload<T>(rpc): T`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/silpo/client.test.ts
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
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run src/lib/silpo/client.test.ts`).

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/client.ts
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
```

- [ ] **Step 4: Run → PASS** (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/client.ts src/lib/silpo/client.test.ts
git commit -m "feat(silpo): MCP tools/call client with token refresh"
```

---

### Task 5: Quantity conversion (pure)

**Files:**
- Create: `src/lib/silpo/quantity.ts`
- Test: `src/lib/silpo/quantity.test.ts`

**Interfaces:**
- Produces: `parseDisplayRatio(ratio): { amount: number; unit: BaseUnit } | null`, `toBaseUnits(quantity, unit): { amount; unit: BaseUnit } | null`, `computeQuantity(need: { quantity: number; unit: string }, product: Pick<SilpoProduct, 'weighted' | 'step' | 'displayRatio' | 'stock'>): { quantity: number; approximate: boolean }`, `quantityStep(product): number`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/silpo/quantity.test.ts
import { describe, it, expect } from 'vitest';
import { parseDisplayRatio, toBaseUnits, computeQuantity } from './quantity';

describe('parseDisplayRatio', () => {
  it.each([
    ['800г', { amount: 800, unit: 'g' }],
    ['0,5кг', { amount: 500, unit: 'g' }],
    ['1 кг', { amount: 1000, unit: 'g' }],
    ['950мл', { amount: 950, unit: 'ml' }],
    ['1л', { amount: 1000, unit: 'ml' }],
    ['10шт', { amount: 10, unit: 'pc' }],
    ['шт', { amount: 1, unit: 'pc' }],
    ['100г', { amount: 100, unit: 'g' }],
  ])('parses %s', (input, expected) => {
    expect(parseDisplayRatio(input)).toEqual(expected);
  });
  it('returns null for unknown or empty', () => {
    expect(parseDisplayRatio('')).toBeNull();
    expect(parseDisplayRatio(null)).toBeNull();
    expect(parseDisplayRatio('пачка')).toBeNull();
  });
});

describe('toBaseUnits', () => {
  it.each([
    [200, 'г', { amount: 200, unit: 'g' }],
    [1.5, 'кг', { amount: 1500, unit: 'g' }],
    [300, 'мл', { amount: 300, unit: 'ml' }],
    [2, 'л', { amount: 2000, unit: 'ml' }],
    [3, 'шт', { amount: 3, unit: 'pc' }],
    [2, 'ст.л.', { amount: 30, unit: 'g' }],
    [1, 'ч.л.', { amount: 5, unit: 'g' }],
    [1, 'скл.', { amount: 250, unit: 'ml' }],
  ])('%s %s', (q, u, expected) => {
    expect(toBaseUnits(q, u)).toEqual(expected);
  });
  it('returns null for vague units', () => {
    expect(toBaseUnits(1, 'пучок')).toBeNull();
    expect(toBaseUnits(1, 'за смаком')).toBeNull();
  });
});

describe('computeQuantity — piece goods', () => {
  const pack800 = { weighted: false, step: 1, displayRatio: '800г', stock: 30 };
  it('rounds packs up', () => {
    expect(computeQuantity({ quantity: 1000, unit: 'г' }, pack800)).toEqual({ quantity: 2, approximate: false });
  });
  it('never returns less than one pack', () => {
    expect(computeQuantity({ quantity: 50, unit: 'г' }, pack800)).toEqual({ quantity: 1, approximate: false });
  });
  it('treats ml vs g as interchangeable but approximate', () => {
    expect(computeQuantity({ quantity: 900, unit: 'мл' }, pack800)).toEqual({ quantity: 2, approximate: true });
  });
  it('falls back to one approximate pack when units are incompatible', () => {
    expect(computeQuantity({ quantity: 3, unit: 'шт' }, pack800)).toEqual({ quantity: 1, approximate: true });
    expect(computeQuantity({ quantity: 1, unit: 'пучок' }, pack800)).toEqual({ quantity: 1, approximate: true });
  });
  it('handles piece packs', () => {
    const eggs = { weighted: false, step: 1, displayRatio: '10шт', stock: 20 };
    expect(computeQuantity({ quantity: 14, unit: 'шт' }, eggs)).toEqual({ quantity: 2, approximate: false });
  });
  it('caps at stock', () => {
    expect(computeQuantity({ quantity: 5000, unit: 'г' }, { ...pack800, stock: 3 })).toEqual({ quantity: 3, approximate: false });
  });
});

describe('computeQuantity — weighted goods (kg)', () => {
  const chicken = { weighted: true, step: 0.5, displayRatio: '100г', stock: 10 };
  it('converts grams to kg rounded up to step', () => {
    expect(computeQuantity({ quantity: 700, unit: 'г' }, chicken)).toEqual({ quantity: 1, approximate: false });
    expect(computeQuantity({ quantity: 1200, unit: 'г' }, chicken)).toEqual({ quantity: 1.5, approximate: false });
  });
  it('never returns less than one step', () => {
    expect(computeQuantity({ quantity: 50, unit: 'г' }, chicken)).toEqual({ quantity: 0.5, approximate: false });
  });
  it('estimates 150 g per piece for weighted produce', () => {
    const tomato = { weighted: true, step: 0.25, displayRatio: '100г', stock: 10 };
    expect(computeQuantity({ quantity: 4, unit: 'шт' }, tomato)).toEqual({ quantity: 0.75, approximate: true });
  });
  it('caps at stock (multiple of step)', () => {
    expect(computeQuantity({ quantity: 20000, unit: 'г' }, { ...chicken, stock: 2.7 })).toEqual({ quantity: 2.5, approximate: false });
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/quantity.ts
import { SilpoProduct } from './types';

export type BaseUnit = 'g' | 'ml' | 'pc';
export interface BaseAmount { amount: number; unit: BaseUnit }

const GRAMS_PER_PIECE_ESTIMATE = 0.15; // kg, used when a weighted product is requested in pieces

const UNIT_TABLE: Array<{ match: RegExp; unit: BaseUnit; factor: number }> = [
  { match: /^(г|гр|грам|грамів|g)$/i, unit: 'g', factor: 1 },
  { match: /^(кг|kg)$/i, unit: 'g', factor: 1000 },
  { match: /^(мл|ml)$/i, unit: 'ml', factor: 1 },
  { match: /^(л|l)$/i, unit: 'ml', factor: 1000 },
  { match: /^(шт|шт\.|штук|штуки|pc|pcs)$/i, unit: 'pc', factor: 1 },
  { match: /^(ст\.?\s?л\.?|столова ложка|столові ложки)$/i, unit: 'g', factor: 15 },
  { match: /^(ч\.?\s?л\.?|чайна ложка|чайні ложки)$/i, unit: 'g', factor: 5 },
  { match: /^(скл\.?|склянка|склянки|стакан)$/i, unit: 'ml', factor: 250 },
];

export function toBaseUnits(quantity: number, unit: string): BaseAmount | null {
  const u = unit.trim().toLowerCase();
  for (const row of UNIT_TABLE) {
    if (row.match.test(u)) return { amount: quantity * row.factor, unit: row.unit };
  }
  return null;
}

/** "800г" → 800 g; "0,5кг" → 500 g; "10шт" → 10 pc; "шт" → 1 pc. */
export function parseDisplayRatio(ratio: string | null | undefined): BaseAmount | null {
  if (!ratio) return null;
  const s = ratio.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*([а-яa-z.]+)$/i);
  if (!m) return null;
  const num = m[1] ? parseFloat(m[1]) : 1;
  const parsed = toBaseUnits(num, m[2]);
  // Only real packaging units make sense here (not spoons/glasses).
  if (!parsed || !/^(г|гр|кг|мл|л|шт|шт\.)$/.test(m[2])) return null;
  return parsed;
}

function roundUpToStep(value: number, step: number): number {
  const steps = Math.ceil(value / step - 1e-9);
  return Math.max(1, steps) * step;
}

function roundToStep3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** UI stepper increment: kg step for weighted goods, 1 pack otherwise. */
export function quantityStep(product: Pick<SilpoProduct, 'weighted' | 'step'>): number {
  return product.weighted ? product.step || 0.1 : 1;
}

export function computeQuantity(
  need: { quantity: number; unit: string },
  product: Pick<SilpoProduct, 'weighted' | 'step' | 'displayRatio' | 'stock'>,
): { quantity: number; approximate: boolean } {
  const base = toBaseUnits(need.quantity, need.unit);

  if (product.weighted) {
    const step = product.step > 0 ? product.step : 0.1;
    let kg: number;
    let approximate = false;
    if (!base) { kg = step; approximate = true; }
    else if (base.unit === 'pc') { kg = base.amount * GRAMS_PER_PIECE_ESTIMATE; approximate = true; }
    else { kg = base.amount / 1000; approximate = base.unit === 'ml'; }
    let qty = roundUpToStep(kg, step);
    if (product.stock > 0 && qty > product.stock) {
      qty = Math.max(step, Math.floor(product.stock / step + 1e-9) * step);
    }
    return { quantity: roundToStep3(qty), approximate };
  }

  const pack = parseDisplayRatio(product.displayRatio);
  let packs = 1;
  let approximate = false;
  if (!base || !pack) {
    approximate = true;
  } else if (base.unit === pack.unit) {
    packs = Math.ceil(base.amount / pack.amount - 1e-9);
  } else if (base.unit !== 'pc' && pack.unit !== 'pc') {
    packs = Math.ceil(base.amount / pack.amount - 1e-9); // g vs ml — density ≈ 1
    approximate = true;
  } else {
    approximate = true;
  }
  packs = Math.max(1, packs);
  if (product.stock > 0 && packs > product.stock) packs = Math.max(1, Math.floor(product.stock));
  return { quantity: packs, approximate };
}
```

- [ ] **Step 4: Run → PASS.** Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/quantity.ts src/lib/silpo/quantity.test.ts
git commit -m "feat(silpo): unit parsing and pack/kg quantity computation"
```

---

### Task 6: Cart context with fresh timeslot

**Files:**
- Create: `src/lib/silpo/cartContext.ts`
- Test: `src/lib/silpo/cartContext.test.ts`

**Interfaces:**
- Consumes: `callTool` (Task 4).
- Produces: `resolveCartContext(userEmail): Promise<CartContextResult>`, `getCartRaw(userEmail, cartId): Promise<RawCart>`, `fetchAvailableSlots(userEmail, branchId, deliveryType): Promise<Slot[]>`, `chooseTimeslot(current, slots): { slot: Slot; changed: boolean }` (pure), `searchDeliveryType(t): string` (pure), `getCartSummary(userEmail): Promise<{ city; street; deliveryType } | null>`, and `RawCart`, `Slot` types.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/silpo/cartContext.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SilpoToolError } from './types';

vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { chooseTimeslot, resolveCartContext, searchDeliveryType } from './cartContext';

const slot = (h: number, available = true) => ({
  start: `2026-09-18T${String(h).padStart(2, '0')}:00:00+00:00`,
  end: `2026-09-18T${String(h).padStart(2, '0')}:30:00+00:00`,
  available, minOrderCost: 199,
});

describe('chooseTimeslot', () => {
  it('keeps the current slot when it is still available', () => {
    const r = chooseTimeslot(slot(11), [slot(10), slot(11)]);
    expect(r).toEqual({ slot: slot(11), changed: false });
  });
  it('picks the first available slot otherwise', () => {
    expect(chooseTimeslot(slot(5), [slot(10), slot(11)])).toEqual({ slot: slot(10), changed: true });
    expect(chooseTimeslot(null, [slot(10)])).toEqual({ slot: slot(10), changed: true });
  });
  it('throws no-slots when nothing is available', () => {
    expect(() => chooseTimeslot(null, [])).toThrow(SilpoToolError);
    expect(() => chooseTimeslot(null, [])).toThrow('no-slots');
  });
});

describe('searchDeliveryType', () => {
  it('maps express to DeliveryHome', () => {
    expect(searchDeliveryType('DeliveryExpressByPromise')).toBe('DeliveryHome');
    expect(searchDeliveryType('SelfPickup')).toBe('SelfPickup');
  });
});

describe('resolveCartContext', () => {
  const cart = {
    id: 'cart-1', deliveryType: 'SelfPickup', timeslot: slot(5),
    address: { addressType: 'self-pickup', city: 'Тернопіль', street: 'вул. Петлюри, 2Б', latitude: '1', longitude: '2' },
    shipments: [{ id: 's', companyId: 'comp', branchId: 'br', products: [] }],
    calculation: { totalAfterDiscounts: 0, validations: [] },
  };
  beforeEach(() => vi.mocked(callTool).mockReset());

  it('returns no-cart when the user has none', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ success: true, exists: false, shoppingCartId: null });
    await expect(resolveCartContext('u')).resolves.toEqual({ kind: 'no-cart' });
  });

  it('updates a stale timeslot and returns the context', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, exists: true, shoppingCartId: 'cart-1' })
      .mockResolvedValueOnce({ success: true, cart })
      .mockResolvedValueOnce({ success: true, slots: [slot(4, false), slot(10), slot(11)] })
      .mockResolvedValueOnce({ success: true });

    const res = await resolveCartContext('u');

    expect(res.kind).toBe('ready');
    if (res.kind !== 'ready') return;
    expect(res.ctx).toMatchObject({
      cartId: 'cart-1', branchId: 'br', companyId: 'comp', deliveryType: 'SelfPickup',
      timeslot: { start: slot(10).start, end: slot(10).end }, minOrderCost: 199,
      address: { city: 'Тернопіль', street: 'вул. Петлюри, 2Б' },
    });
    const update = vi.mocked(callTool).mock.calls[3];
    expect(update[1]).toBe('silpo_update_shopping_cart');
    expect(update[2]).toMatchObject({
      shoppingCartId: 'cart-1', deliveryType: 'SelfPickup',
      timeslot: { start: slot(10).start, end: slot(10).end },
      shipments: [{ companyId: 'comp', branchId: 'br' }],
    });
  });

  it('does not touch the cart when its slot is still valid', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, exists: true, shoppingCartId: 'cart-1' })
      .mockResolvedValueOnce({ success: true, cart: { ...cart, timeslot: slot(10) } })
      .mockResolvedValueOnce({ success: true, slots: [slot(10)] });
    await resolveCartContext('u');
    expect(vi.mocked(callTool)).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/cartContext.ts
import { callTool } from './client';
import { CartContextResult, SilpoTimeslot, SilpoToolError, SilpoValidation } from './types';

export interface Slot extends SilpoTimeslot {
  available: boolean;
  minOrderCost: number | null;
}

export interface RawCart {
  id: string;
  deliveryType: string;
  timeslot: SilpoTimeslot | null;
  address: Record<string, unknown> & { city?: string | null; street?: string | null };
  shipments: Array<{ id?: string; companyId: string; branchId: string; products?: unknown[] }>;
  calculation?: { totalAfterDiscounts?: number; validations?: SilpoValidation[] };
  checkoutWebLink?: string | null;
  checkoutMobileLink?: string | null;
}

interface MyCartResponse { success: boolean; exists: boolean; shoppingCartId: string | null }
interface CartResponse { success: boolean; cart: RawCart }
interface SlotsResponse { success: boolean; slots?: Slot[] }

/** Express carts search/browse as regular home delivery (per Silpo tool docs). */
export function searchDeliveryType(cartDeliveryType: string): string {
  return cartDeliveryType === 'DeliveryExpressByPromise' ? 'DeliveryHome' : cartDeliveryType;
}

export async function getCartRaw(userEmail: string, cartId: string): Promise<RawCart> {
  const res = await callTool<CartResponse>(userEmail, 'silpo_get_shopping_cart_by_id', { shoppingCartId: cartId });
  return res.cart;
}

export async function fetchAvailableSlots(userEmail: string, branchId: string, deliveryType: string): Promise<Slot[]> {
  const res = await callTool<SlotsResponse>(userEmail, 'silpo_get_time_slots', {
    branchId, deliveryTypes: [deliveryType], start: new Date().toISOString(), limit: 40,
  });
  return (res.slots ?? []).filter((s) => s.available);
}

/** Keep the cart's slot if it's still offered; otherwise the earliest available one. */
export function chooseTimeslot(current: SilpoTimeslot | null, slots: Slot[]): { slot: Slot; changed: boolean } {
  const available = slots.filter((s) => s.available);
  if (available.length === 0) throw new SilpoToolError('no-slots');
  const same = current && available.find((s) => s.start === current.start && s.end === current.end);
  if (same) return { slot: same, changed: false };
  return { slot: available[0], changed: true };
}

export async function resolveCartContext(userEmail: string): Promise<CartContextResult> {
  const mine = await callTool<MyCartResponse>(userEmail, 'silpo_get_my_shopping_cart');
  if (!mine.exists || !mine.shoppingCartId) return { kind: 'no-cart' };

  const cart = await getCartRaw(userEmail, mine.shoppingCartId);
  const shipment = cart.shipments?.[0];
  if (!shipment) return { kind: 'no-cart' };

  const deliveryType = searchDeliveryType(cart.deliveryType);
  const slots = await fetchAvailableSlots(userEmail, shipment.branchId, deliveryType);
  const { slot, changed } = chooseTimeslot(cart.timeslot, slots);

  if (changed) {
    await callTool(userEmail, 'silpo_update_shopping_cart', {
      shoppingCartId: cart.id,
      deliveryType: cart.deliveryType,
      timeslot: { start: slot.start, end: slot.end },
      address: cart.address,
      shipments: cart.shipments.map((s) => ({ companyId: s.companyId, branchId: s.branchId })),
    });
  }

  return {
    kind: 'ready',
    ctx: {
      cartId: cart.id,
      branchId: shipment.branchId,
      companyId: shipment.companyId,
      deliveryType,
      timeslot: { start: slot.start, end: slot.end },
      minOrderCost: slot.minOrderCost ?? null,
      address: { city: cart.address?.city ?? null, street: cart.address?.street ?? null },
    },
  };
}

/** Cheap summary for the status endpoint: no slot lookups, no writes. */
export async function getCartSummary(
  userEmail: string,
): Promise<{ city: string | null; street: string | null; deliveryType: string } | null> {
  const mine = await callTool<MyCartResponse>(userEmail, 'silpo_get_my_shopping_cart');
  if (!mine.exists || !mine.shoppingCartId) return null;
  const cart = await getCartRaw(userEmail, mine.shoppingCartId);
  return { city: cart.address?.city ?? null, street: cart.address?.street ?? null, deliveryType: cart.deliveryType };
}
```

- [ ] **Step 4: Run → PASS** (7 tests). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/cartContext.ts src/lib/silpo/cartContext.test.ts
git commit -m "feat(silpo): resolve cart context and refresh stale timeslot"
```

---

### Task 7: Address → delivery options → create cart

**Files:**
- Create: `src/lib/silpo/setupCart.ts`
- Test: `src/lib/silpo/setupCart.test.ts`

**Interfaces:**
- Consumes: `callTool`, `fetchAvailableSlots`.
- Produces: `ResolvedAddress`, `DeliveryOption`, `haversineKm(a, b)`, `nearestBranch(branches, point)`, `lookupDeliveryOptions(userEmail, addressText): Promise<{ address: ResolvedAddress; options: DeliveryOption[] }>`, `createCart(userEmail, address: ResolvedAddress, option: DeliveryOption): Promise<void>`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/silpo/setupCart.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { haversineKm, nearestBranch, lookupDeliveryOptions, createCart } from './setupCart';

const branch = (id: string, lat: number, lng: number, open = true) => ({
  branchId: id, companyId: 'comp', city: 'Тернопіль', address: `вул. ${id}`,
  latitude: String(lat), longitude: String(lng), hasPickup: true, open,
});

describe('haversineKm', () => {
  it('Kyiv → Ternopil is roughly 370 km', () => {
    const d = haversineKm({ lat: 50.45, lng: 30.52 }, { lat: 49.55, lng: 25.59 });
    expect(d).toBeGreaterThan(350);
    expect(d).toBeLessThan(390);
  });
});

describe('nearestBranch', () => {
  it('returns the closest open pickup branch', () => {
    const b = nearestBranch([branch('far', 50.45, 30.52), branch('near', 49.56, 25.60), branch('closed', 49.555, 25.592, false)], { lat: 49.555, lng: 25.592 });
    expect(b?.branchId).toBe('near');
  });
  it('returns null when none qualify', () => {
    expect(nearestBranch([branch('x', 1, 1, false)], { lat: 1, lng: 1 })).toBeNull();
  });
});

describe('lookupDeliveryOptions', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());

  it('offers home delivery and nearest pickup', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, addresses: [{ address: 'Тернопіль', city: 'Тернопіль', street: null, houseNumber: null, district: null, latitude: 49.5558, longitude: 25.5924 }] })
      .mockResolvedValueOnce({ success: true, options: [
        { deliveryType: 'DeliveryHome', branchId: 'home-br', description: '' },
        { deliveryType: 'NovaPoshta', branchId: null, description: '' },
        { deliveryType: 'SelfPickup', branchId: null, description: '' },
      ] })
      .mockResolvedValueOnce({ success: true, branches: [branch('far', 50.45, 30.52), branch('near', 49.556, 25.60)], meta: { total: 2 } });

    const res = await lookupDeliveryOptions('u', 'Тернопіль');

    expect(res.address.city).toBe('Тернопіль');
    expect(res.options).toEqual([
      { deliveryType: 'DeliveryHome', branchId: 'home-br', label: 'Доставка додому' },
      expect.objectContaining({ deliveryType: 'SelfPickup', branchId: 'near', label: 'Самовивіз: Тернопіль, вул. near' }),
    ]);
  });

  it('throws address-not-found when geocoding is empty', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ success: true, addresses: [] });
    await expect(lookupDeliveryOptions('u', 'qwerty')).rejects.toThrow('address-not-found');
  });
});

describe('createCart', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  const address = { text: 'Тернопіль, Руська 1', city: 'Тернопіль', street: 'вулиця Руська', houseNumber: '1', district: null, latitude: 49.55, longitude: 25.59 };

  it('creates a home-delivery cart with the first available slot', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, slots: [{ start: 's', end: 'e', available: true, minOrderCost: 699 }] })
      .mockResolvedValueOnce({ success: true, shoppingCartId: 'new' });
    await createCart('u', address, { deliveryType: 'DeliveryHome', branchId: 'home-br', label: 'Доставка додому' });
    const call = vi.mocked(callTool).mock.calls[1];
    expect(call[1]).toBe('silpo_create_shopping_cart');
    expect(call[2]).toEqual({
      addressType: 'house', latitude: 49.55, longitude: 25.59, city: 'Тернопіль', street: 'вулиця Руська', house: '1',
      deliveryType: 'DeliveryHome', timeslot: { start: 's', end: 'e' }, branchId: 'home-br',
    });
  });

  it('creates a self-pickup cart at the branch coordinates', async () => {
    vi.mocked(callTool)
      .mockResolvedValueOnce({ success: true, slots: [{ start: 's', end: 'e', available: true, minOrderCost: 199 }] })
      .mockResolvedValueOnce({ success: true, shoppingCartId: 'new' });
    await createCart('u', address, {
      deliveryType: 'SelfPickup', branchId: 'near', label: 'Самовивіз',
      branch: { city: 'Тернопіль', address: 'вул. near', latitude: 49.556, longitude: 25.6 },
    });
    expect(vi.mocked(callTool).mock.calls[1][2]).toEqual({
      addressType: 'self-pickup', latitude: 49.556, longitude: 25.6, city: 'Тернопіль', street: 'вул. near',
      deliveryType: 'SelfPickup', timeslot: { start: 's', end: 'e' }, branchId: 'near',
    });
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/setupCart.ts
import { callTool } from './client';
import { fetchAvailableSlots } from './cartContext';
import { SilpoToolError } from './types';

export interface ResolvedAddress {
  text: string;
  city: string | null;
  street: string | null;
  houseNumber: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
}

export interface DeliveryOption {
  deliveryType: 'DeliveryHome' | 'SelfPickup';
  branchId: string;
  label: string;
  branch?: { city: string; address: string; latitude: number; longitude: number };
}

interface Branch {
  branchId: string; companyId: string; city: string; address: string;
  latitude: string; longitude: string; hasPickup: boolean; open: boolean;
}
interface FindAddressResponse {
  addresses?: Array<{ address: string; city: string | null; street: string | null; houseNumber: string | null; district: string | null; latitude: number; longitude: number }>;
}
interface DeliveryTypesResponse { options?: Array<{ deliveryType: string; branchId: string | null }> }
interface BranchesResponse { branches?: Branch[] }

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestBranch(branches: Branch[], point: { lat: number; lng: number }): Branch | null {
  let best: Branch | null = null;
  let bestKm = Infinity;
  for (const b of branches) {
    if (!b.open || !b.hasPickup) continue;
    const km = haversineKm(point, { lat: parseFloat(b.latitude), lng: parseFloat(b.longitude) });
    if (km < bestKm) { bestKm = km; best = b; }
  }
  return best;
}

export async function lookupDeliveryOptions(
  userEmail: string, addressText: string,
): Promise<{ address: ResolvedAddress; options: DeliveryOption[] }> {
  const geo = await callTool<FindAddressResponse>(userEmail, 'silpo_find_address', { address: addressText });
  const first = geo.addresses?.[0];
  if (!first) throw new SilpoToolError('address-not-found');
  const address: ResolvedAddress = {
    text: addressText, city: first.city, street: first.street, houseNumber: first.houseNumber,
    district: first.district, latitude: first.latitude, longitude: first.longitude,
  };

  const types = await callTool<DeliveryTypesResponse>(userEmail, 'silpo_get_available_delivery_types', {
    latitude: address.latitude, longitude: address.longitude,
  });
  const options: DeliveryOption[] = [];
  const home = types.options?.find((o) => o.deliveryType === 'DeliveryHome' && o.branchId);
  if (home?.branchId) options.push({ deliveryType: 'DeliveryHome', branchId: home.branchId, label: 'Доставка додому' });

  if (types.options?.some((o) => o.deliveryType === 'SelfPickup')) {
    const list = await callTool<BranchesResponse>(userEmail, 'silpo_list_branches', { hasPickup: true, limit: 500 });
    const near = nearestBranch(list.branches ?? [], { lat: address.latitude, lng: address.longitude });
    if (near) {
      options.push({
        deliveryType: 'SelfPickup', branchId: near.branchId,
        label: `Самовивіз: ${near.city}, ${near.address}`,
        branch: { city: near.city, address: near.address, latitude: parseFloat(near.latitude), longitude: parseFloat(near.longitude) },
      });
    }
  }
  if (options.length === 0) throw new SilpoToolError('no-delivery');
  return { address, options };
}

function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

export async function createCart(userEmail: string, address: ResolvedAddress, option: DeliveryOption): Promise<void> {
  const slots = await fetchAvailableSlots(userEmail, option.branchId, option.deliveryType);
  if (slots.length === 0) throw new SilpoToolError('no-slots');
  const timeslot = { start: slots[0].start, end: slots[0].end };

  const args = option.deliveryType === 'SelfPickup' && option.branch
    ? compact({
        addressType: 'self-pickup', latitude: option.branch.latitude, longitude: option.branch.longitude,
        city: option.branch.city, street: option.branch.address,
        deliveryType: 'SelfPickup', timeslot, branchId: option.branchId,
      })
    : compact({
        addressType: 'house', latitude: address.latitude, longitude: address.longitude,
        city: address.city, street: address.street, house: address.houseNumber, district: address.district,
        deliveryType: option.deliveryType, timeslot, branchId: option.branchId,
      });

  await callTool(userEmail, 'silpo_create_shopping_cart', args);
}
```

- [ ] **Step 4: Run → PASS** (7 tests). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/setupCart.ts src/lib/silpo/setupCart.test.ts
git commit -m "feat(silpo): address lookup, delivery options and cart creation"
```

---

### Task 8: Product matching (batch search + LLM ranking)

**Files:**
- Create: `src/lib/silpo/matchProducts.ts`
- Test: `src/lib/silpo/matchProducts.test.ts`

**Interfaces:**
- Consumes: `callTool`, `computeQuantity`, `SilpoCartContext`, `SilpoMatch`, `SilpoProduct`.
- Produces: `MatchInput { itemId; name; quantity; unit }`, `MatchPrefs { allergies: string[]; dislikedFoods: string[]; dietaryPreferences: string[] }`, `searchCandidates(userEmail, ctx, names): Promise<Map<string, SilpoProduct[]>>`, `rankCandidates(items, candidates, prefs, llm): Promise<Map<string, string | null>>`, `matchShoppingItems(userEmail, items, ctx, prefs): Promise<{ matches: SilpoMatch[]; unmatched: SilpoUnmatched[]; total: number; llmUsed: boolean }>`.
- LLM is injected as `llm: (system: string, user: string) => Promise<string>` so tests never call OpenAI; default implementation uses `gpt-4.1-mini`.

- [ ] **Step 1: Failing tests**

```ts
// src/lib/silpo/matchProducts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./client', () => ({ callTool: vi.fn() }));
import { callTool } from './client';
import { matchShoppingItems, rankCandidates, searchCandidates } from './matchProducts';
import { SilpoProduct } from './types';

const ctx = { cartId: 'c', branchId: 'br', companyId: 'co', deliveryType: 'SelfPickup', timeslot: { start: 's', end: 'e' }, minOrderCost: 199, address: { city: null, street: null } };
const prod = (id: string, name: string, extra: Partial<SilpoProduct> = {}): SilpoProduct => ({
  id, name, slug: id, price: 100, oldPrice: null, stock: 10, available: true, image: null,
  weighted: false, step: 1, displayRatio: '800г', companyId: 'co', branchId: 'br', externalProductId: 1, ...extra,
});
const prefs = { allergies: [], dislikedFoods: [], dietaryPreferences: [] };

describe('searchCandidates', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  it('chunks names by 30 and keys results by query, dropping unavailable products', async () => {
    const names = Array.from({ length: 31 }, (_, i) => `p${i}`);
    vi.mocked(callTool)
      .mockResolvedValueOnce({ queries: names.slice(0, 30).map((q) => ({ query: q, totalFound: 1, products: [prod(q, q)] })) })
      .mockResolvedValueOnce({ queries: [{ query: 'p30', totalFound: 2, products: [prod('a', 'a', { available: false }), prod('b', 'b', { stock: 0 }), prod('c', 'c')] }] });
    const map = await searchCandidates('u', ctx, names);
    expect(vi.mocked(callTool)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(callTool).mock.calls[0][2]).toMatchObject({ branchId: 'br', deliveryType: 'SelfPickup', timeslotStart: 's', timeslotEnd: 'e', limit: 6 });
    expect(map.get('p0')?.[0].id).toBe('p0');
    expect(map.get('p30')?.map((p) => p.id)).toEqual(['c']);
  });
});

describe('rankCandidates', () => {
  const items = [{ itemId: 'i1', name: 'Кисломолочний сир', quantity: 400, unit: 'г' }];
  const candidates = new Map([[ 'Кисломолочний сир', [prod('baby', 'Сирок Milupa дитячий'), prod('cheese', 'Сир кисломолочний 9%')] ]]);

  it('uses the LLM choice when it names a real candidate', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { i1: 'cheese' } }));
    const r = await rankCandidates(items, candidates, prefs, llm);
    expect(r.get('i1')).toBe('cheese');
    expect(llm.mock.calls[0][1]).toContain('Сирок Milupa');
  });
  it('honours an explicit null (no suitable product)', async () => {
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { i1: null } }));
    expect((await rankCandidates(items, candidates, prefs, llm)).get('i1')).toBeNull();
  });
  it('falls back to the first candidate when the LLM fails or hallucinates', async () => {
    expect((await rankCandidates(items, candidates, prefs, vi.fn().mockRejectedValue(new Error('down')))).get('i1')).toBe('baby');
    expect((await rankCandidates(items, candidates, prefs, vi.fn().mockResolvedValue('{"choices":{"i1":"ghost"}}'))).get('i1')).toBe('baby');
  });
  it('skips the LLM entirely when no item has candidates', async () => {
    const llm = vi.fn();
    await rankCandidates(items, new Map(), prefs, llm);
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('matchShoppingItems', () => {
  beforeEach(() => vi.mocked(callTool).mockReset());
  it('builds matches with quantities, alternatives, totals and unmatched', async () => {
    vi.mocked(callTool).mockResolvedValueOnce({ queries: [
      { query: 'Гречка', totalFound: 2, products: [prod('g1', 'Гречка 800г', { price: 109 }), prod('g2', 'Батончик гречка', { price: 125 })] },
      { query: 'Єдиноріг', totalFound: 0, products: [] },
    ] });
    const llm = vi.fn().mockResolvedValue(JSON.stringify({ choices: { a: 'g1' } }));
    const res = await matchShoppingItems('u', [
      { itemId: 'a', name: 'Гречка', quantity: 1000, unit: 'г' },
      { itemId: 'b', name: 'Єдиноріг', quantity: 1, unit: 'шт' },
    ], ctx, prefs, llm);

    expect(res.unmatched).toEqual([{ itemId: 'b', name: 'Єдиноріг' }]);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0]).toMatchObject({ itemId: 'a', quantity: 2, approximate: false, lineTotal: 218 });
    expect(res.matches[0].alternatives.map((p) => p.id)).toEqual(['g2']);
    expect(res.total).toBe(218);
    expect(res.llmUsed).toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/lib/silpo/matchProducts.ts
import OpenAI from 'openai';
import { callTool } from './client';
import { computeQuantity } from './quantity';
import { SilpoCartContext, SilpoMatch, SilpoProduct, SilpoUnmatched } from './types';

export interface MatchInput { itemId: string; name: string; quantity: number; unit: string }
export interface MatchPrefs { allergies: string[]; dislikedFoods: string[]; dietaryPreferences: string[] }
export type LlmCall = (system: string, user: string) => Promise<string>;

const BATCH_SIZE = 30;
const CANDIDATES_PER_ITEM = 6;

interface BatchResponse {
  queries?: Array<{ query: string; totalFound: number; products: SilpoProduct[] }>;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Runs `silpo_find_products_batch` in chunks of 30; map key = the query string sent. */
export async function searchCandidates(
  userEmail: string, ctx: SilpoCartContext, names: string[],
): Promise<Map<string, SilpoProduct[]>> {
  const result = new Map<string, SilpoProduct[]>();
  for (const part of chunk(names, BATCH_SIZE)) {
    const res = await callTool<BatchResponse>(userEmail, 'silpo_find_products_batch', {
      branchId: ctx.branchId,
      deliveryType: ctx.deliveryType,
      timeslotStart: ctx.timeslot.start,
      timeslotEnd: ctx.timeslot.end,
      products: part,
      limit: CANDIDATES_PER_ITEM,
    });
    for (const q of res.queries ?? []) {
      result.set(q.query, (q.products ?? []).filter((p) => p.available && p.stock > 0));
    }
  }
  return result;
}

const RANK_SYSTEM = `You choose grocery products for a Ukrainian shopping list. For each list item you get up to ${CANDIDATES_PER_ITEM} candidate products found in a Silpo supermarket search.

Pick the ONE candidate a sensible home cook would buy for that ingredient:
- Prefer the plain, basic version of the ingredient (e.g. "Сир кисломолочний 9%" for "кисломолочний сир"), not baby food, snacks, bars, ready meals, smoked/salted/marinated variants, or products where the ingredient is only an additive.
- Prefer a package size close to the needed amount; among equals prefer the cheaper one.
- Never pick a product that contains an allergen or a disliked food from the user's preferences.
- If NO candidate is genuinely the requested ingredient, answer null for that item.

Reply with ONLY valid JSON: {"choices": {"<itemId>": "<productId or null>", ...}}. Include every itemId you were given.`;

function pickFallback(candidates: SilpoProduct[] | undefined): string | null {
  return candidates?.[0]?.id ?? null;
}

export async function rankCandidates(
  items: MatchInput[],
  candidates: Map<string, SilpoProduct[]>,
  prefs: MatchPrefs,
  llm: LlmCall,
): Promise<Map<string, string | null>> {
  const withCandidates = items.filter((it) => (candidates.get(it.name)?.length ?? 0) > 0);
  const result = new Map<string, string | null>();
  if (withCandidates.length === 0) return result;

  const payload = {
    preferences: prefs,
    items: withCandidates.map((it) => ({
      itemId: it.itemId,
      need: `${it.name} ${it.quantity} ${it.unit}`,
      candidates: (candidates.get(it.name) ?? []).map((p) => ({
        id: p.id, name: p.name, price: p.price, displayRatio: p.displayRatio, weighted: p.weighted,
      })),
    })),
  };

  let choices: Record<string, unknown> = {};
  try {
    const raw = await llm(RANK_SYSTEM, JSON.stringify(payload));
    const parsed = JSON.parse(raw) as { choices?: Record<string, unknown> };
    choices = parsed.choices ?? {};
  } catch {
    choices = {};
  }

  for (const it of withCandidates) {
    const list = candidates.get(it.name) ?? [];
    const hasKey = Object.prototype.hasOwnProperty.call(choices, it.itemId);
    const choice = choices[it.itemId];
    if (hasKey && choice === null) { result.set(it.itemId, null); continue; }
    if (typeof choice === 'string' && list.some((p) => p.id === choice)) { result.set(it.itemId, choice); continue; }
    result.set(it.itemId, pickFallback(list));
  }
  return result;
}

let openaiClient: OpenAI | null = null;
export const defaultLlm: LlmCall = async (system, user) => {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing');
  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await openaiClient.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return res.choices[0]?.message?.content ?? '{}';
};

export function buildMatch(item: MatchInput, product: SilpoProduct, alternatives: SilpoProduct[]): SilpoMatch {
  const { quantity, approximate } = computeQuantity({ quantity: item.quantity, unit: item.unit }, product);
  return {
    itemId: item.itemId,
    itemName: item.name,
    itemQuantity: item.quantity,
    itemUnit: item.unit,
    product,
    alternatives,
    quantity,
    approximate,
    lineTotal: Math.round(quantity * product.price * 100) / 100,
  };
}

export async function matchShoppingItems(
  userEmail: string,
  items: MatchInput[],
  ctx: SilpoCartContext,
  prefs: MatchPrefs,
  llm: LlmCall = defaultLlm,
): Promise<{ matches: SilpoMatch[]; unmatched: SilpoUnmatched[]; total: number; llmUsed: boolean }> {
  const names = Array.from(new Set(items.map((it) => it.name)));
  const candidates = await searchCandidates(userEmail, ctx, names);

  let llmUsed = true;
  const tracked: LlmCall = async (s, u) => {
    try { return await llm(s, u); } catch (e) { llmUsed = false; throw e; }
  };
  const choices = await rankCandidates(items, candidates, prefs, tracked);

  const matches: SilpoMatch[] = [];
  const unmatched: SilpoUnmatched[] = [];
  for (const it of items) {
    const list = candidates.get(it.name) ?? [];
    const chosenId = choices.get(it.itemId) ?? null;
    const product = chosenId ? list.find((p) => p.id === chosenId) : undefined;
    if (!product) { unmatched.push({ itemId: it.itemId, name: it.name }); continue; }
    matches.push(buildMatch(it, product, list.filter((p) => p.id !== product.id)));
  }
  const total = Math.round(matches.reduce((s, m) => s + m.lineTotal, 0) * 100) / 100;
  return { matches, unmatched, total, llmUsed };
}
```

- [ ] **Step 4: Run → PASS** (7 tests). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/silpo/matchProducts.ts src/lib/silpo/matchProducts.test.ts
git commit -m "feat(silpo): batch product search with LLM candidate ranking"
```

---

### Task 9: OAuth + connection API routes

**Files:**
- Create: `src/lib/silpo/apiErrors.ts`
- Create: `src/app/api/silpo/connect/route.ts`
- Create: `src/app/api/silpo/callback/route.ts`
- Create: `src/app/api/silpo/status/route.ts`
- Create: `src/app/api/silpo/connection/route.ts`

**Interfaces:**
- Produces: `silpoErrorResponse(err: unknown): NextResponse` mapping `SilpoNotConnectedError→409 not-connected`, `SilpoAuthError→401 reconnect`, `SilpoRateLimitError→429 rate-limit`, `SilpoToolError('no-slots')→409 no-slots`, `SilpoToolError('address-not-found')→404 address-not-found`, `SilpoToolError('no-delivery')→409 no-delivery`, other→502 silpo-error. Status JSON shape: `{ enabled: boolean; connected: boolean; status: 'active'|'expired'|null; cart: { city; street; deliveryType } | null }`.

- [ ] **Step 1: Error mapper**

```ts
// src/lib/silpo/apiErrors.ts
import { NextResponse } from 'next/server';
import { SilpoAuthError, SilpoNotConnectedError, SilpoRateLimitError, SilpoToolError } from './types';

export function silpoErrorResponse(err: unknown): NextResponse {
  if (err instanceof SilpoNotConnectedError) return NextResponse.json({ error: 'not-connected' }, { status: 409 });
  if (err instanceof SilpoAuthError) return NextResponse.json({ error: 'reconnect' }, { status: 401 });
  if (err instanceof SilpoRateLimitError) return NextResponse.json({ error: 'rate-limit' }, { status: 429 });
  if (err instanceof SilpoToolError) {
    if (err.message === 'no-slots') return NextResponse.json({ error: 'no-slots' }, { status: 409 });
    if (err.message === 'no-delivery') return NextResponse.json({ error: 'no-delivery' }, { status: 409 });
    if (err.message === 'address-not-found') return NextResponse.json({ error: 'address-not-found' }, { status: 404 });
    console.error('Silpo tool error:', err.message);
    return NextResponse.json({ error: 'silpo-error', message: err.message.slice(0, 300) }, { status: 502 });
  }
  console.error('Silpo unexpected error:', err);
  return NextResponse.json({ error: 'silpo-error' }, { status: 502 });
}

const RETURN_TO_WHITELIST = new Set(['/shopping-list', '/profile']);
export function safeReturnTo(value: string | null): string {
  return value && RETURN_TO_WHITELIST.has(value) ? value : '/profile';
}
```

- [ ] **Step 2: connect route**

```ts
// src/app/api/silpo/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { buildAuthorizeUrl, generatePkce, getRedirectUri, getSilpoClientId, isSilpoEnabled } from '@/lib/silpo/oauth';
import { createOauthState } from '@/lib/silpo/connections';
import { safeReturnTo } from '@/lib/silpo/apiErrors';

export async function GET(req: NextRequest) {
  if (!isSilpoEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.redirect(new URL('/auth/login', req.url));

  const returnTo = safeReturnTo(req.nextUrl.searchParams.get('returnTo'));
  const { verifier, challenge, state } = generatePkce();
  await createOauthState({ state, userEmail, verifier, returnTo });

  const url = buildAuthorizeUrl({
    clientId: getSilpoClientId() as string,
    redirectUri: getRedirectUri(),
    challenge,
    state,
  });
  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: callback route**

```ts
// src/app/api/silpo/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { exchangeCode, getRedirectUri, getSilpoClientId, isSilpoEnabled } from '@/lib/silpo/oauth';
import { consumeOauthState, saveTokens } from '@/lib/silpo/connections';

function back(req: NextRequest, path: string, result: 'connected' | 'error') {
  const url = new URL(path, req.url);
  url.searchParams.set('silpo', result);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!isSilpoEnabled()) return NextResponse.json({ error: 'disabled' }, { status: 404 });
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state) return back(req, '/profile', 'error');

  const pending = await consumeOauthState(state);
  if (!pending) return back(req, '/profile', 'error');

  // The state is bound to the session that started the flow.
  const userEmail = await readSessionUserId();
  if (!userEmail || userEmail !== pending.userEmail) return back(req, pending.returnTo, 'error');

  try {
    const tokens = await exchangeCode({
      code, verifier: pending.verifier, clientId: getSilpoClientId() as string, redirectUri: getRedirectUri(),
    });
    await saveTokens(userEmail, tokens);
    return back(req, pending.returnTo, 'connected');
  } catch (err) {
    console.error('Silpo OAuth callback failed:', err);
    return back(req, pending.returnTo, 'error');
  }
}
```

- [ ] **Step 4: status route**

```ts
// src/app/api/silpo/status/route.ts
import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { isSilpoEnabled } from '@/lib/silpo/oauth';
import { getConnection } from '@/lib/silpo/connections';
import { getCartSummary } from '@/lib/silpo/cartContext';
import { SilpoAuthError } from '@/lib/silpo/types';

export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = isSilpoEnabled();
  if (!enabled) return NextResponse.json({ enabled, connected: false, status: null, cart: null });

  const conn = await getConnection(userEmail);
  if (!conn) return NextResponse.json({ enabled, connected: false, status: null, cart: null });
  if (conn.status === 'expired') return NextResponse.json({ enabled, connected: false, status: 'expired', cart: null });

  try {
    const cart = await getCartSummary(userEmail);
    return NextResponse.json({ enabled, connected: true, status: 'active', cart });
  } catch (err) {
    if (err instanceof SilpoAuthError) return NextResponse.json({ enabled, connected: false, status: 'expired', cart: null });
    // Cart lookup is best-effort; the connection itself is fine.
    return NextResponse.json({ enabled, connected: true, status: 'active', cart: null });
  }
}
```

- [ ] **Step 5: connection DELETE route**

```ts
// src/app/api/silpo/connection/route.ts
import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { decryptTokens, deleteConnection, getConnection } from '@/lib/silpo/connections';
import { getSilpoClientId, revokeToken } from '@/lib/silpo/oauth';

export async function DELETE() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const conn = await getConnection(userEmail);
  if (conn) {
    try {
      const { accessToken } = decryptTokens(conn);
      await revokeToken(accessToken, getSilpoClientId() ?? '');
    } catch {
      // revoke is best-effort
    }
    await deleteConnection(userEmail);
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: `npx tsc --noEmit` → exit 0. Commit**

```bash
git add src/lib/silpo/apiErrors.ts src/app/api/silpo
git commit -m "feat(silpo): OAuth connect/callback, status and disconnect routes"
```

---

### Task 10: Match + cart API routes

**Files:**
- Create: `src/app/api/silpo/match/route.ts`
- Create: `src/app/api/silpo/cart/options/route.ts`
- Create: `src/app/api/silpo/cart/create/route.ts`
- Create: `src/app/api/silpo/cart/add/route.ts`

**Interfaces:**
- Request/response shapes exactly as in the spec's API table. `POST /api/silpo/match` body `{ items: [{ itemId, quantity }] }` → `{ matches, unmatched, total, llmUsed, context: { city, deliveryType, minOrderCost } }` or 409 `{ error: 'no-cart' }`.
- `POST /api/silpo/cart/add` body `{ products: [{ productId, companyId, branchId, quantity }] }` → `SilpoAddResult`.

- [ ] **Step 1: match route**

```ts
// src/app/api/silpo/match/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { ShoppingListItem } from '@/types/shoppingList';
import { UserProfile } from '@/types/userProfile';
import { resolveCartContext } from '@/lib/silpo/cartContext';
import { matchShoppingItems, MatchInput } from '@/lib/silpo/matchProducts';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

const MAX_ITEMS = 60;

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { items?: Array<{ itemId?: unknown; quantity?: unknown }> };
  const requested = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (requested.length === 0) return NextResponse.json({ error: 'items required' }, { status: 400 });

  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne<{ items: ShoppingListItem[] }>(
    { userEmail }, { sort: { weekStartDate: -1 } },
  );
  if (!list) return NextResponse.json({ error: 'No shopping list' }, { status: 404 });

  const byId = new Map(list.items.map((i) => [i.id, i]));
  const items: MatchInput[] = [];
  for (const r of requested) {
    if (typeof r.itemId !== 'string') continue;
    const item = byId.get(r.itemId);
    if (!item) continue;
    const quantity = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : item.quantity;
    items.push({ itemId: item.id, name: item.name, quantity, unit: item.unit });
  }
  if (items.length === 0) return NextResponse.json({ error: 'No valid items' }, { status: 400 });

  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
  const prefs = {
    allergies: profile?.allergies ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    dietaryPreferences: profile?.dietaryPreferences ?? [],
  };

  try {
    const context = await resolveCartContext(userEmail);
    if (context.kind === 'no-cart') return NextResponse.json({ error: 'no-cart' }, { status: 409 });

    const result = await matchShoppingItems(userEmail, items, context.ctx, prefs);
    return NextResponse.json({
      ...result,
      context: {
        city: context.ctx.address.city,
        deliveryType: context.ctx.deliveryType,
        minOrderCost: context.ctx.minOrderCost,
      },
    });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
```

- [ ] **Step 2: cart/options route**

```ts
// src/app/api/silpo/cart/options/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { lookupDeliveryOptions } from '@/lib/silpo/setupCart';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { address?: unknown };
  const address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
  if (address.length < 3) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    return NextResponse.json(await lookupDeliveryOptions(userEmail, address));
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
```

- [ ] **Step 3: cart/create route**

```ts
// src/app/api/silpo/cart/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { createCart, DeliveryOption, ResolvedAddress } from '@/lib/silpo/setupCart';
import { getCartSummary } from '@/lib/silpo/cartContext';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

function isAddress(v: unknown): v is ResolvedAddress {
  const a = v as ResolvedAddress;
  return !!a && typeof a.latitude === 'number' && typeof a.longitude === 'number';
}
function isOption(v: unknown): v is DeliveryOption {
  const o = v as DeliveryOption;
  return !!o && (o.deliveryType === 'DeliveryHome' || o.deliveryType === 'SelfPickup') && typeof o.branchId === 'string';
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { address?: unknown; option?: unknown };
  if (!isAddress(body.address) || !isOption(body.option)) {
    return NextResponse.json({ error: 'address and option required' }, { status: 400 });
  }

  try {
    await createCart(userEmail, body.address, body.option);
    const cart = await getCartSummary(userEmail);
    return NextResponse.json({ cart });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
```

- [ ] **Step 4: cart/add route**

```ts
// src/app/api/silpo/cart/add/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { callTool } from '@/lib/silpo/client';
import { getCartRaw, resolveCartContext } from '@/lib/silpo/cartContext';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';
import { SilpoAddResult } from '@/lib/silpo/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRODUCTS = 60;

interface ProductInput { productId: string; companyId: string; branchId: string; quantity: number }

function isProduct(v: unknown): v is ProductInput {
  const p = v as ProductInput;
  return !!p && UUID.test(p.productId) && UUID.test(p.companyId) && UUID.test(p.branchId)
    && typeof p.quantity === 'number' && p.quantity > 0;
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { products?: unknown[] };
  const products = (Array.isArray(body.products) ? body.products : []).filter(isProduct).slice(0, MAX_PRODUCTS);
  if (products.length === 0) return NextResponse.json({ error: 'products required' }, { status: 400 });

  try {
    const context = await resolveCartContext(userEmail);
    if (context.kind === 'no-cart') return NextResponse.json({ error: 'no-cart' }, { status: 409 });

    await callTool(userEmail, 'silpo_add_or_update_cart_products', {
      shoppingCartId: context.ctx.cartId,
      products: products.map((p) => ({
        productId: p.productId, companyId: p.companyId, branchId: p.branchId, quantity: p.quantity,
      })),
    });

    const cart = await getCartRaw(userEmail, context.ctx.cartId);
    const result: SilpoAddResult = {
      totalAfterDiscounts: cart.calculation?.totalAfterDiscounts ?? 0,
      minOrderCost: context.ctx.minOrderCost,
      validations: cart.calculation?.validations ?? [],
      checkoutWebLink: cart.checkoutWebLink ?? null,
      checkoutMobileLink: cart.checkoutMobileLink ?? null,
    };
    return NextResponse.json(result);
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
```

- [ ] **Step 5: `npx tsc --noEmit` → exit 0. Commit**

```bash
git add src/app/api/silpo
git commit -m "feat(silpo): match, cart options/create and cart add routes"
```

---

### Task 11: Analytics events + client hook

**Files:**
- Modify: `src/lib/analytics/events.ts` (extend union)
- Create: `src/hooks/useSilpoConnection.ts`

**Interfaces:**
- Produces: `SilpoStatus { enabled; connected; status: 'active' | 'expired' | null; cart: { city; street; deliveryType } | null }`; `useSilpoConnection(): { data: SilpoStatus | null; loading: boolean; refresh(): Promise<void>; disconnect(): Promise<void>; connectHref(returnTo: string): string; flash: 'connected' | 'error' | null }`.

- [ ] **Step 1: Add events** — in `src/lib/analytics/events.ts`, after `| 'login_completed'` change to:

```ts
  | 'login_completed'
  // Silpo integration
  | 'silpo_connected'
  | 'silpo_disconnected'
  | 'silpo_match_requested'
  | 'silpo_match_result'
  | 'silpo_cart_added';
```

- [ ] **Step 2: Hook**

```ts
// src/hooks/useSilpoConnection.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { track } from '@/lib/analytics';

export interface SilpoStatus {
  enabled: boolean;
  connected: boolean;
  status: 'active' | 'expired' | null;
  cart: { city: string | null; street: string | null; deliveryType: string } | null;
}

/** Reads `?silpo=connected|error` once (set by the OAuth callback) and strips it from the URL. */
function readFlash(): 'connected' | 'error' | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const value = url.searchParams.get('silpo');
  if (value !== 'connected' && value !== 'error') return null;
  url.searchParams.delete('silpo');
  window.history.replaceState({}, '', url.toString());
  return value;
}

export function useSilpoConnection() {
  const [data, setData] = useState<SilpoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<'connected' | 'error' | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/silpo/status');
      if (res.ok) setData((await res.json()) as SilpoStatus);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const f = readFlash();
    if (f) {
      setFlash(f);
      if (f === 'connected') track('silpo_connected');
    }
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    const res = await fetch('/api/silpo/connection', { method: 'DELETE' });
    if (res.ok) {
      track('silpo_disconnected');
      setData((prev) => (prev ? { ...prev, connected: false, status: null, cart: null } : prev));
    }
  }, []);

  const connectHref = useCallback(
    (returnTo: string) => `/api/silpo/connect?returnTo=${encodeURIComponent(returnTo)}`,
    [],
  );

  return { data, loading, refresh, disconnect, connectHref, flash };
}
```

- [ ] **Step 3: `npx tsc --noEmit`; run `npm test` (analytics tests must still pass). Commit**

```bash
git add src/lib/analytics/events.ts src/hooks/useSilpoConnection.ts
git commit -m "feat(silpo): analytics events and connection status hook"
```

---

### Task 12: Profile section «Сільпо»

**Files:**
- Create: `src/components/profilePage/SilpoConnectSettings.tsx`
- Modify: `src/app/profile/page.tsx` (insert section between «Застосунок» and «Незабаром»)

- [ ] **Step 1: Component**

```tsx
// src/components/profilePage/SilpoConnectSettings.tsx
'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShoppingCart, Unplug } from 'lucide-react';
import { useSilpoConnection } from '@/hooks/useSilpoConnection';
import { ToastContainer, ToastData } from '@/components/common/Toast';

export default function SilpoConnectSettings() {
  const { data, loading, disconnect, connectHref, flash } = useSilpoConnection();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    if (!flash) return;
    setToasts([{
      id: crypto.randomUUID(),
      message: flash === 'connected' ? 'Сільпо підключено' : 'Не вдалося підключити Сільпо',
      emoji: flash === 'connected' ? '🛒' : '😔',
      type: flash === 'connected' ? 'success' : 'error',
    }]);
  }, [flash]);

  if (loading || !data || !data.enabled) return null;

  const handleDisconnect = async () => {
    setBusy(true);
    try { await disconnect(); } finally { setBusy(false); setConfirming(false); }
  };

  const address = data.cart
    ? [data.cart.city, data.cart.street].filter(Boolean).join(', ')
    : null;

  return (
    <section className="mx-4 mb-4">
      <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span>🛒</span> Сільпо
      </p>

      {data.connected ? (
        <div className="rounded-2xl bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-card dark:bg-night-card flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sage-dark dark:text-sage-light" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-ink dark:text-night-ink">Підключено</p>
              <p className="text-xs text-ink/60 dark:text-night-muted truncate">
                {address
                  ? `${data.cart?.deliveryType === 'SelfPickup' ? 'Самовивіз' : 'Доставка'}: ${address}`
                  : 'Кошик ще не налаштовано, адресу спитаємо при першому замовленні'}
              </p>
            </div>
          </div>
          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void handleDisconnect()}
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-danger text-card text-sm font-semibold active:scale-95 transition-all disabled:opacity-60"
              >
                {busy ? '…' : 'Відключити'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-xl border border-ink/10 dark:border-night-ink/10 text-sm font-semibold text-ink dark:text-night-ink"
              >
                Скасувати
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-ink/50 dark:text-night-muted hover:text-danger transition-colors"
            >
              <Unplug size={14} /> Відключити акаунт Сільпо
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-terracotta-light/20 dark:bg-terracotta/15 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-terracotta-dark dark:text-terracotta-light" />
            </div>
            <div>
              <p className="font-semibold text-sm text-ink dark:text-night-ink">
                {data.status === 'expired' ? 'Сесія Сільпо закінчилась' : 'Замовляйте продукти в Сільпо'}
              </p>
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
                Підключіть акаунт, і список покупок можна буде одним натисканням додати в кошик Сільпо.
              </p>
            </div>
          </div>
          <a
            href={connectHref('/profile')}
            className="mt-3 w-full rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold shadow-soft active:scale-95 transition-all py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {data.status === 'expired' ? 'Підключити знову' : 'Підключити Сільпо'}
          </a>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </section>
  );
}
```

- [ ] **Step 2: Wire into profile page** — in `src/app/profile/page.tsx` add `import SilpoConnectSettings from '@/components/profilePage/SilpoConnectSettings';` next to the other profilePage imports, and insert `<SilpoConnectSettings />` right after the closing `</section>` of the «Застосунок (PWA)» section (before `{/* В розробці */}`).

- [ ] **Step 3: `npx tsc --noEmit`. Visual check later in Task 15. Commit**

```bash
git add src/components/profilePage/SilpoConnectSettings.tsx src/app/profile/page.tsx
git commit -m "feat(profile): Silpo connect/disconnect section"
```

---

### Task 13: Shopping list button + order sheet

**Files:**
- Create: `src/components/shoppingListPage/SilpoOrderButton.tsx`
- Create: `src/components/shoppingListPage/SilpoOrderSheet.tsx`
- Modify: `src/components/shoppingListPage/ShoppingListView.tsx`

**Interfaces:**
- `SilpoOrderButton({ status: SilpoStatus | null; count: number; onClick(): void })`
- `SilpoOrderSheet({ isOpen; onClose(); items: OrderItem[]; onDone(msg: string): void })` where `OrderItem = { itemId; name; quantity; unit }`.
- Uses `quantityStep` from `@/lib/silpo/quantity` (pure, safe on client) and types from `@/lib/silpo/types` (type-only import).

- [ ] **Step 1: Button**

```tsx
// src/components/shoppingListPage/SilpoOrderButton.tsx
'use client';

import { ShoppingCart, ChevronRight } from 'lucide-react';
import type { SilpoStatus } from '@/hooks/useSilpoConnection';

interface Props {
  status: SilpoStatus | null;
  count: number;
  onClick: () => void;
}

export function SilpoOrderButton({ status, count, onClick }: Props) {
  if (!status?.enabled) return null;

  if (!status.connected) {
    return (
      <div className="px-4 pb-2">
        <a
          href={`/api/silpo/connect?returnTo=${encodeURIComponent('/shopping-list')}`}
          className="flex items-center justify-between rounded-2xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2 text-ink/70 dark:text-night-muted">
            <ShoppingCart size={16} /> Замовити продукти в Сільпо
          </span>
          <span className="flex items-center gap-1 font-semibold text-terracotta">
            {status.status === 'expired' ? 'Підключити знову' : 'Підключити'} <ChevronRight size={16} />
          </span>
        </a>
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className="px-4 pb-2">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold py-3 text-sm shadow-soft active:scale-95 transition-all"
      >
        <ShoppingCart size={18} /> Замовити в Сільпо ({count})
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Sheet**

```tsx
// src/components/shoppingListPage/SilpoOrderSheet.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Minus, Plus, RefreshCw } from 'lucide-react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { quantityStep } from '@/lib/silpo/quantity';
import type { SilpoAddResult, SilpoMatch, SilpoProduct, SilpoUnmatched } from '@/lib/silpo/types';
import type { DeliveryOption, ResolvedAddress } from '@/lib/silpo/setupCart';
import { track } from '@/lib/analytics';

export interface OrderItem { itemId: string; name: string; quantity: number; unit: string }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: OrderItem[];
  onDone: (message: string) => void;
}

type Step =
  | { kind: 'loading' }
  | { kind: 'address'; options: DeliveryOption[] | null; address: ResolvedAddress | null; error: string | null }
  | { kind: 'preview'; matches: SilpoMatch[]; unmatched: SilpoUnmatched[]; llmUsed: boolean; context: { city: string | null; deliveryType: string; minOrderCost: number | null } }
  | { kind: 'adding' }
  | { kind: 'done'; result: SilpoAddResult }
  | { kind: 'error'; message: string; reconnect?: boolean };

const ERROR_TEXT: Record<string, string> = {
  'rate-limit': 'Сільпо тимчасово перевантажене, спробуйте за хвилину',
  'no-slots': 'Магазин зараз не приймає замовлення, спробуйте пізніше',
  'no-delivery': 'За цією адресою Сільпо не доставляє і немає магазину поруч',
  'address-not-found': 'Адресу не знайдено, уточніть місто та вулицю',
  reconnect: 'Сесія Сільпо закінчилась, підключіть акаунт знову',
  'not-connected': 'Сільпо не підключено',
  'silpo-error': 'Сільпо не відповідає, спробуйте ще раз',
};

function fmt(n: number): string {
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}
function fmtQty(match: Pick<SilpoMatch, 'product'>, qty: number): string {
  return match.product.weighted ? `${fmt(qty)} кг` : `${qty} уп.`;
}

function validationText(v: { message: string; context: unknown }): string | null {
  const ctx = (v.context ?? {}) as Record<string, unknown>;
  if (v.message === 'product.offer.stock.max') return `Частину товарів обмежено залишком (доступно ${String(ctx.stock ?? '?')})`;
  if (v.message.startsWith('timeslot')) return 'Оберіть час доставки при оформленні';
  if (v.message.startsWith('order.min')) return 'Сума менша за мінімальне замовлення';
  return null;
}

export function SilpoOrderSheet({ isOpen, onClose, items, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Record<string, SilpoProduct>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [altOpen, setAltOpen] = useState<string | null>(null);
  const [addressText, setAddressText] = useState('');
  const [pickedOption, setPickedOption] = useState<DeliveryOption | null>(null);
  const [busy, setBusy] = useState(false);

  const runMatch = useCallback(async () => {
    setStep({ kind: 'loading' });
    track('silpo_match_requested', { items: items.length });
    try {
      const res = await fetch('/api/silpo/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })) }),
      });
      const data = await res.json() as { error?: string } & Extract<Step, { kind: 'preview' }>;
      if (res.status === 409 && data.error === 'no-cart') {
        setStep({ kind: 'address', options: null, address: null, error: null });
        return;
      }
      if (!res.ok) {
        setStep({ kind: 'error', message: ERROR_TEXT[data.error ?? ''] ?? ERROR_TEXT['silpo-error'], reconnect: data.error === 'reconnect' });
        return;
      }
      track('silpo_match_result', { matched: data.matches.length, unmatched: data.unmatched.length });
      setSelected(new Set(data.matches.map((m) => m.itemId)));
      setChosen(Object.fromEntries(data.matches.map((m) => [m.itemId, m.product])));
      setQty(Object.fromEntries(data.matches.map((m) => [m.itemId, m.quantity])));
      setStep({ kind: 'preview', matches: data.matches, unmatched: data.unmatched, llmUsed: data.llmUsed, context: data.context });
    } catch {
      setStep({ kind: 'error', message: ERROR_TEXT['silpo-error'] });
    }
  }, [items]);

  useEffect(() => {
    if (isOpen) void runMatch();
  }, [isOpen, runMatch]);

  const lookupOptions = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/silpo/cart/options', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: addressText }),
      });
      const data = await res.json() as { error?: string; address?: ResolvedAddress; options?: DeliveryOption[] };
      if (!res.ok || !data.options) {
        setStep({ kind: 'address', options: null, address: null, error: ERROR_TEXT[data.error ?? ''] ?? ERROR_TEXT['silpo-error'] });
        return;
      }
      setPickedOption(data.options[0]);
      setStep({ kind: 'address', options: data.options, address: data.address ?? null, error: null });
    } finally {
      setBusy(false);
    }
  };

  const createCartAndMatch = async () => {
    if (step.kind !== 'address' || !step.address || !pickedOption) return;
    setBusy(true);
    try {
      const res = await fetch('/api/silpo/cart/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: step.address, option: pickedOption }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setStep({ ...step, error: ERROR_TEXT[data.error ?? ''] ?? ERROR_TEXT['silpo-error'] });
        return;
      }
      await runMatch();
    } finally {
      setBusy(false);
    }
  };

  const preview = step.kind === 'preview' ? step : null;

  const total = useMemo(() => {
    if (!preview) return 0;
    return preview.matches.reduce((s, m) => {
      if (!selected.has(m.itemId)) return s;
      const p = chosen[m.itemId] ?? m.product;
      return s + (qty[m.itemId] ?? m.quantity) * p.price;
    }, 0);
  }, [preview, selected, chosen, qty]);

  const changeQty = (m: SilpoMatch, dir: 1 | -1) => {
    const p = chosen[m.itemId] ?? m.product;
    const stepSize = quantityStep(p);
    setQty((prev) => {
      const cur = prev[m.itemId] ?? m.quantity;
      const next = Math.round((cur + dir * stepSize) * 1000) / 1000;
      return { ...prev, [m.itemId]: Math.max(stepSize, p.stock > 0 ? Math.min(next, p.stock) : next) };
    });
  };

  const addToCart = async () => {
    if (!preview) return;
    const products = preview.matches
      .filter((m) => selected.has(m.itemId))
      .map((m) => {
        const p = chosen[m.itemId] ?? m.product;
        return { productId: p.id, companyId: p.companyId, branchId: p.branchId, quantity: qty[m.itemId] ?? m.quantity };
      });
    if (products.length === 0) return;
    setStep({ kind: 'adding' });
    try {
      const res = await fetch('/api/silpo/cart/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }),
      });
      const data = await res.json() as SilpoAddResult & { error?: string };
      if (!res.ok) {
        setStep({ kind: 'error', message: ERROR_TEXT[data.error ?? ''] ?? ERROR_TEXT['silpo-error'], reconnect: data.error === 'reconnect' });
        return;
      }
      track('silpo_cart_added', { products: products.length, total: Math.round(data.totalAfterDiscounts) });
      setStep({ kind: 'done', result: data });
      onDone(`${products.length} товарів додано в кошик Сільпо`);
    } catch {
      setStep({ kind: 'error', message: ERROR_TEXT['silpo-error'] });
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Замовити в Сільпо">
      <div className="px-5 pb-6">
        {step.kind === 'loading' && (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl animate-spin inline-block">🌀</div>
            <p className="text-sm text-ink/60 dark:text-night-muted">Підбираємо товари у вашому Сільпо…</p>
          </div>
        )}

        {step.kind === 'address' && (
          <div className="py-4 space-y-3">
            <p className="text-sm text-ink/70 dark:text-night-muted">
              У вашому Сільпо ще немає кошика. Вкажіть адресу, щоб ми обрали магазин у вашому місті.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="Місто, вулиця, будинок"
                className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 text-ink dark:text-night-ink placeholder:text-ink/40 dark:placeholder:text-night-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50"
              />
              <button
                onClick={() => void lookupOptions()}
                disabled={busy || addressText.trim().length < 3}
                className="px-4 py-2.5 bg-sage hover:bg-sage-dark text-card font-semibold rounded-2xl text-sm disabled:opacity-50 active:scale-95 transition-all"
              >
                {busy && !step.options ? '…' : 'Знайти'}
              </button>
            </div>
            {step.error && <p className="text-xs text-danger dark:text-danger-dark">{step.error}</p>}
            {step.options && (
              <div className="space-y-2">
                {step.options.map((o) => (
                  <label key={o.deliveryType} className="flex items-center gap-3 rounded-2xl border border-ink/10 dark:border-night-ink/10 px-4 py-3 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="silpo-delivery"
                      checked={pickedOption?.deliveryType === o.deliveryType}
                      onChange={() => setPickedOption(o)}
                      className="accent-sage"
                    />
                    <span className="text-ink dark:text-night-ink">{o.label}</span>
                  </label>
                ))}
                <button
                  onClick={() => void createCartAndMatch()}
                  disabled={busy || !pickedOption}
                  className="w-full py-3 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl text-sm shadow-soft disabled:opacity-50 active:scale-95 transition-all"
                >
                  {busy ? 'Створюємо кошик…' : 'Продовжити'}
                </button>
              </div>
            )}
          </div>
        )}

        {preview && (
          <div className="py-3">
            <p className="text-xs text-ink/50 dark:text-night-muted mb-3">
              {preview.context.deliveryType === 'SelfPickup' ? 'Самовивіз' : 'Доставка'}
              {preview.context.city ? ` · ${preview.context.city}` : ''}
              {!preview.llmUsed ? ' · підбір спрощений' : ''}
            </p>

            <ul className="space-y-2">
              {preview.matches.map((m) => {
                const p = chosen[m.itemId] ?? m.product;
                const q = qty[m.itemId] ?? m.quantity;
                const isSel = selected.has(m.itemId);
                const alts = [m.product, ...m.alternatives].filter((a) => a.id !== p.id);
                return (
                  <li key={m.itemId} className={`rounded-2xl border p-3 transition-colors ${isSel ? 'border-sage/50 bg-sage-light/20 dark:bg-sage/10' : 'border-ink/10 dark:border-night-ink/10 opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(m.itemId)) n.delete(m.itemId); else n.add(m.itemId); return n; })}
                        className="mt-1 accent-sage w-4 h-4"
                        aria-label={`Включити ${p.name}`}
                      />
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover bg-cream flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-cream dark:bg-night flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-night-ink leading-snug">{p.name}</p>
                        <p className="text-xs text-ink/50 dark:text-night-muted">
                          {p.displayRatio ?? ''} · {fmt(p.price)} ₴{p.weighted ? '/кг' : ''} · для: {m.itemName} {fmt(m.itemQuantity)} {m.itemUnit}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => changeQty(m, -1)} className="w-7 h-7 rounded-full bg-card dark:bg-night-card shadow-soft flex items-center justify-center text-ink dark:text-night-ink" aria-label="Менше"><Minus size={14} /></button>
                            <span className="text-sm font-semibold min-w-[3.5rem] text-center text-ink dark:text-night-ink">
                              {m.approximate ? '≈ ' : ''}{fmtQty(m, q)}
                            </span>
                            <button onClick={() => changeQty(m, 1)} className="w-7 h-7 rounded-full bg-card dark:bg-night-card shadow-soft flex items-center justify-center text-ink dark:text-night-ink" aria-label="Більше"><Plus size={14} /></button>
                          </div>
                          <span className="text-sm font-semibold text-ink dark:text-night-ink">{fmt(q * p.price)} ₴</span>
                        </div>
                        {alts.length > 0 && (
                          <button onClick={() => setAltOpen(altOpen === m.itemId ? null : m.itemId)} className="mt-1.5 flex items-center gap-1 text-xs text-terracotta font-semibold">
                            <RefreshCw size={12} /> Замінити
                          </button>
                        )}
                        {altOpen === m.itemId && (
                          <ul className="mt-2 space-y-1">
                            {alts.map((a) => (
                              <li key={a.id}>
                                <button
                                  onClick={() => { setChosen((prev) => ({ ...prev, [m.itemId]: a })); setQty((prev) => ({ ...prev, [m.itemId]: quantityStep(a) === 1 ? Math.max(1, Math.round(prev[m.itemId] ?? 1)) : quantityStep(a) })); setAltOpen(null); }}
                                  className="w-full text-left text-xs px-3 py-2 rounded-xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 text-ink dark:text-night-ink"
                                >
                                  {a.name} <span className="text-ink/50 dark:text-night-muted">· {a.displayRatio ?? ''} · {fmt(a.price)} ₴</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {preview.unmatched.length > 0 && (
              <div className="mt-4 rounded-2xl bg-cream dark:bg-night p-3">
                <p className="text-xs font-semibold text-ink/60 dark:text-night-muted mb-1">Не знайшли в Сільпо</p>
                <p className="text-xs text-ink/60 dark:text-night-muted">{preview.unmatched.map((u) => u.name).join(', ')}</p>
              </div>
            )}

            <div className="mt-4 border-t border-ink/10 dark:border-night-ink/10 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-ink/70 dark:text-night-muted">Разом</span>
                <span className="font-heading font-bold text-lg text-ink dark:text-night-ink">≈ {fmt(total)} ₴</span>
              </div>
              {preview.context.minOrderCost != null && total < preview.context.minOrderCost && (
                <p className="text-xs text-terracotta-dark dark:text-terracotta-light flex items-center gap-1 mb-2">
                  <AlertTriangle size={12} /> Мінімальне замовлення {fmt(preview.context.minOrderCost)} ₴
                </p>
              )}
              <button
                onClick={() => void addToCart()}
                disabled={selected.size === 0}
                className="w-full py-3.5 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl text-sm shadow-soft disabled:opacity-50 active:scale-95 transition-all"
              >
                Додати в кошик Сільпо ({selected.size})
              </button>
            </div>
          </div>
        )}

        {step.kind === 'adding' && (
          <div className="py-12 text-center space-y-3">
            <div className="text-4xl animate-spin inline-block">🌀</div>
            <p className="text-sm text-ink/60 dark:text-night-muted">Додаємо в кошик…</p>
          </div>
        )}

        {step.kind === 'done' && (
          <div className="py-6 text-center space-y-4">
            <div className="text-5xl">🛒</div>
            <div>
              <p className="font-heading font-semibold text-lg text-ink dark:text-night-ink">Товари в кошику Сільпо</p>
              <p className="text-sm text-ink/60 dark:text-night-muted mt-1">До оплати ≈ {fmt(step.result.totalAfterDiscounts)} ₴</p>
            </div>
            {step.result.minOrderCost != null && step.result.totalAfterDiscounts < step.result.minOrderCost && (
              <p className="text-xs text-terracotta-dark dark:text-terracotta-light">Мінімальне замовлення {fmt(step.result.minOrderCost)} ₴, додайте ще товарів у застосунку Сільпо.</p>
            )}
            {step.result.validations.filter((v) => v.level === 'error' || v.level === 'warning').map((v, i) => {
              const text = validationText(v);
              return text ? <p key={i} className="text-xs text-ink/60 dark:text-night-muted">{text}</p> : null;
            })}
            <div className="flex flex-col gap-2 pt-2">
              {step.result.checkoutWebLink && (
                <a href={step.result.checkoutWebLink} target="_blank" rel="noopener noreferrer" className="w-full py-3 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl text-sm shadow-soft flex items-center justify-center gap-2">
                  Оформити на сайті <ExternalLink size={14} />
                </a>
              )}
              {step.result.checkoutMobileLink && (
                <a href={step.result.checkoutMobileLink} target="_blank" rel="noopener noreferrer" className="w-full py-3 border-2 border-ink/15 dark:border-night-ink/15 text-ink dark:text-night-ink font-semibold rounded-2xl text-sm flex items-center justify-center gap-2">
                  Оформити в застосунку <ExternalLink size={14} />
                </a>
              )}
              {!step.result.checkoutWebLink && !step.result.checkoutMobileLink && (
                <p className="text-xs text-ink/50 dark:text-night-muted">Відкрийте застосунок або сайт Сільпо, щоб завершити замовлення.</p>
              )}
              <button onClick={onClose} className="text-sm text-ink/50 dark:text-night-muted py-2">Закрити</button>
            </div>
          </div>
        )}

        {step.kind === 'error' && (
          <div className="py-10 text-center space-y-4">
            <span className="text-5xl">😔</span>
            <p className="text-sm text-ink/70 dark:text-night-muted">{step.message}</p>
            {step.reconnect ? (
              <a href={`/api/silpo/connect?returnTo=${encodeURIComponent('/shopping-list')}`} className="inline-block px-6 py-3 bg-terracotta text-card font-semibold rounded-2xl text-sm shadow-soft">
                Підключити Сільпо знову
              </a>
            ) : (
              <button onClick={() => void runMatch()} className="inline-flex items-center gap-2 text-sm text-terracotta font-semibold">
                <RefreshCw size={16} /> Спробувати знову
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 3: Wire into `ShoppingListView.tsx`**

Add imports:
```tsx
import { useSilpoConnection } from '@/hooks/useSilpoConnection';
import { SilpoOrderButton } from './SilpoOrderButton';
import { SilpoOrderSheet, OrderItem } from './SilpoOrderSheet';
import { ToastContainer, ToastData } from '@/components/common/Toast';
```
Inside the component, after `const [filter, setFilter] = useState<DayFilter>('all');` add:
```tsx
  const silpo = useSilpoConnection();
  const [silpoOpen, setSilpoOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((message: string, emoji?: string, type: ToastData['type'] = 'success') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, emoji, type }]);
  }, []);
  const removeToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  useEffect(() => {
    if (silpo.flash === 'connected') addToast('Сільпо підключено', '🛒');
    if (silpo.flash === 'error') addToast('Не вдалося підключити Сільпо', '😔', 'error');
  }, [silpo.flash, addToast]);
```
After `filteredItems` is computed add:
```tsx
  const orderItems: OrderItem[] = filteredItems
    .filter((i) => !i.isPurchased)
    .map((i) => ({ itemId: i.id, name: i.name, quantity: i.quantity, unit: i.unit }));
```
In JSX, directly after the `{/* Day filter */}` `<DayFilterTabs …/>` line insert:
```tsx
      <SilpoOrderButton status={silpo.data} count={orderItems.length} onClick={() => setSilpoOpen(true)} />
```
Before the closing `</div>` of the root element add:
```tsx
      <SilpoOrderSheet
        isOpen={silpoOpen}
        onClose={() => setSilpoOpen(false)}
        items={orderItems}
        onDone={(msg) => addToast(msg, '🛒')}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
```

- [ ] **Step 4: `npx tsc --noEmit` → exit 0; `npm test` → all green. Commit**

```bash
git add src/components/shoppingListPage/SilpoOrderButton.tsx src/components/shoppingListPage/SilpoOrderSheet.tsx src/components/shoppingListPage/ShoppingListView.tsx
git commit -m "feat(shopping-list): order in Silpo button and preview sheet"
```

---

### Task 14: Client registration script, env docs

**Files:**
- Create: `scripts/silpo-register-client.mjs`
- Modify: `.env.example` (append)
- Modify: `.env` (local only, not committed): `SILPO_MCP_CLIENT_ID=KK9l9ouVJm5rjMvA`, `SILPO_TOKEN_ENC_KEY=<generated>`

- [ ] **Step 1: Script**

```js
// scripts/silpo-register-client.mjs
// One-off per environment: registers Sytno as an OAuth client on the Silpo MCP
// server (RFC 7591 dynamic registration) and prints the client_id to put into
// SILPO_MCP_CLIENT_ID. Usage: node scripts/silpo-register-client.mjs https://your-domain
const appUrl = process.argv[2]?.replace(/\/$/, '');
if (!appUrl) {
  console.error('Usage: node scripts/silpo-register-client.mjs <APP_URL>');
  process.exit(1);
}
const redirect = `${appUrl}/api/silpo/callback`;
const res = await fetch('https://mcp.silpo.ua/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_name: 'Sytno',
    client_uri: appUrl,
    redirect_uris: [redirect],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error('Registration failed', res.status, body);
  process.exit(1);
}
console.log(`Registered. redirect_uri=${redirect}`);
console.log(`SILPO_MCP_CLIENT_ID=${body.client_id}`);
```

- [ ] **Step 2: `.env.example`** — append:

```
# Silpo MCP integration (feature is hidden unless both are set)
# node scripts/silpo-register-client.mjs https://<domain>  → client_id
SILPO_MCP_CLIENT_ID=
# 32 random bytes, base64: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SILPO_TOKEN_ENC_KEY=
```

- [ ] **Step 3: Local `.env`** — add the dev client id `KK9l9ouVJm5rjMvA` and a freshly generated key. Do not commit `.env`.

- [ ] **Step 4: Commit**

```bash
git add scripts/silpo-register-client.mjs .env.example
git commit -m "chore(silpo): client registration script and env docs"
```

---

### Task 15: Verification (typecheck, tests, live smoke, manual e2e)

- [ ] **Step 1:** `npx tsc --noEmit` → exit 0; `npm test` → all suites pass.
- [ ] **Step 2 (live smoke, no writes to the user's cart products):** with the dev token in the session scratchpad, seed a `silpo_connections` doc for the owner email via a scratchpad Node script that imports nothing from the repo (uses `mongodb` + the same AES-GCM scheme), then call `resolveCartContext` + `matchShoppingItems` through a scratchpad vitest run or a temporary route hit with the dev server and a browser session. Confirm: context resolves with a fresh slot; ≥ 80 % of a real list's items get a match; `llmUsed === true`.
- [ ] **Step 3 (manual e2e in browser, `npm run dev`):**
  1. `/profile` → секція «🛒 Сільпо» → «Підключити Сільпо» → auth.silpo.ua → повернення з тостом «Сільпо підключено», секція показує «Підключено» + адресу.
  2. `/shopping-list` → кнопка «Замовити в Сільпо (N)» → превʼю з товарами, цінами, сумою; «Замінити» показує альтернативи; степер змінює суму.
  3. Вибрати 2–3 товари → «Додати в кошик Сільпо» → екран «Товари в кошику Сільпо» з посиланнями; перевірити в застосунку Сільпо, що товари й кількості збігаються.
  4. `/profile` → «Відключити» → секція повертається до стану «Підключити»; на `/shopping-list` кнопка стає тізером.
  5. Без `SILPO_MCP_CLIENT_ID` в env: жодної секції/кнопки не видно, `/api/silpo/connect` → 404.
- [ ] **Step 4:** Update memory file `silpo-mcp-integration.md` (status: implemented, what's verified) and MEMORY.md line. Final commit if any docs changed.
