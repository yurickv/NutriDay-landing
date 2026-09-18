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
    {
      $set,
      $setOnInsert: { userEmail, connectedAt: now, ...(tokens.refresh_token ? {} : { refreshTokenEnc: null }) },
    },
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
  await db.collection<OauthStateDoc>(STATES).insertOne(doc);
}

/** One-shot: deletes the state so a code can't be replayed. */
export async function consumeOauthState(
  state: string,
): Promise<{ userEmail: string; verifier: string; returnTo: string } | null> {
  const db = await getDb();
  const doc = await db.collection<OauthStateDoc>(STATES).findOneAndDelete({ state });
  if (!doc) return null;
  return { userEmail: doc.userEmail, verifier: decryptSecret(doc.verifierEnc), returnTo: doc.returnTo };
}
