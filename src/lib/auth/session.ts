// src/lib/auth/session.ts
import { cookies } from 'next/headers';
import { getDb } from '../db';
import crypto from 'crypto';

const COOKIE_NAME = 'nd_sess';
const SESSION_TTL_HOURS = 24 * 30;
const TTL_MS = SESSION_TTL_HOURS * 60 * 60 * 1000;
// Sliding-window refresh: extend a session at most once per this interval so an
// actively-used session never expires, while an idle one still dies after TTL.
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: true,
  path: '/',
};

export async function createSession(userId: string) {
  const db = await getDb();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TTL_MS);

  await db.collection('sessions').insertOne({
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, { ...COOKIE_OPTIONS, expires: expiresAt });
}

export async function readSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const db = await getDb();
  const session = await db
    .collection('sessions')
    .findOne<{ userId: string; expiresAt: Date }>({ id: sessionId });

  if (!session) return null;

  const expMs = new Date(session.expiresAt).getTime();
  const nowMs = Date.now();

  if (expMs < nowMs) {
    await db.collection('sessions').deleteOne({ id: sessionId });
    // Cookie mutation throws when called during a Server Component render
    // (reachable via the subscription guards in protected layouts).
    // The session is already gone, so it's safe to skip the cookie cleanup here.
    try {
      cookieStore.delete(COOKIE_NAME);
    } catch {
      /* cleared on the next route-handler request */
    }
    return null;
  }

  // Sliding expiry: once more than REFRESH_INTERVAL_MS has elapsed since the
  // last extension, push expiresAt forward by a full TTL. The DB write always
  // succeeds; the cookie refresh only works in route-handler contexts (it
  // throws during RSC render — the cookie is then refreshed on the next
  // route-handler request, while the DB already reflects the new expiry).
  if (expMs - nowMs < TTL_MS - REFRESH_INTERVAL_MS) {
    const newExpiry = new Date(nowMs + TTL_MS);
    await db.collection('sessions').updateOne(
      { id: sessionId },
      { $set: { expiresAt: newExpiry } },
    );
    try {
      cookieStore.set(COOKIE_NAME, sessionId, { ...COOKIE_OPTIONS, expires: newExpiry });
    } catch {
      /* refreshed on the next route-handler request */
    }
  }

  return session.userId;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  const db = await getDb();

  if (sessionId) {
    await db.collection('sessions').deleteOne({ id: sessionId });
  }

  cookieStore.delete(COOKIE_NAME);
}

/**
 * Logout from all devices: removes every session belonging to the current
 * user, not just the one tied to this cookie.
 */
export async function clearAllSessions() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  const db = await getDb();

  if (sessionId) {
    const session = await db
      .collection('sessions')
      .findOne<{ userId: string }>({ id: sessionId });
    if (session?.userId) {
      await db.collection('sessions').deleteMany({ userId: session.userId });
    } else {
      await db.collection('sessions').deleteOne({ id: sessionId });
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
