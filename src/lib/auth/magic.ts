// src/lib/auth/magic.ts
import crypto from 'crypto';
import { getDb } from '../db';

const MAGIC_TTL_MINUTES = 20;

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueMagicLinkToken(email: string) {
  const db = await getDb();
  const users = db.collection('users');

  const now = new Date();

  // Ensure shadow user exists or is updated; use email as logical user id
  await users.updateOne(
    { email },
    {
      $setOnInsert: {
        status: 'pending',
        createdAt: now,
      },
      $set: {
        updatedAt: now,
      },
    },
    {
      upsert: true,
    }
  );

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + MAGIC_TTL_MINUTES * 60 * 1000);

  await db.collection('magic_links').insertOne({
    userId: email,
    tokenHash,
    expiresAt,
    usedAt: null,
    createdAt: now,
  });

  return { token, userId: email };
}

export async function consumeMagicLinkToken(token: string) {
  const db = await getDb();
  const tokenHash = hashToken(token);

  const magicCollection = db.collection('magic_links');
  const magic = await magicCollection.findOne<{
    userId: string;
    expiresAt: Date;
    usedAt: Date | null;
  }>({ tokenHash });

  if (!magic) return null;
  if (magic.usedAt) return null;
  if (new Date(magic.expiresAt) < new Date()) return null;

  await magicCollection.updateOne(
    { tokenHash },
    {
      $set: {
        usedAt: new Date(),
      },
    }
  );

  const user = await db.collection('users').findOne({ email: magic.userId });
  if (!user) return null;

  return user;
}
