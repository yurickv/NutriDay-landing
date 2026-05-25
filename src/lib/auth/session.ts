// src/lib/auth/session.ts
import { cookies } from 'next/headers';
import { getDb } from '../db';
import crypto from 'crypto';

const COOKIE_NAME = 'nd_sess';
const SESSION_TTL_HOURS = 24 * 30;

export async function createSession(userId: string) {
  const db = await getDb();
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await db.collection('sessions').insertOne({
    id: sessionId,
    userId,
    createdAt: now,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    expires: expiresAt,
    path: '/',
  });
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
  if (new Date(session.expiresAt) < new Date()) {
    await db.collection('sessions').deleteOne({ id: sessionId });
    // Cookie mutation throws when called during a Server Component render
    // (now reachable via the subscription guards in protected layouts).
    // The session is already gone, so it's safe to skip the cookie cleanup here.
    try {
      cookieStore.delete(COOKIE_NAME);
    } catch {
      /* cleared on the next route-handler request */
    }
    return null;
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
