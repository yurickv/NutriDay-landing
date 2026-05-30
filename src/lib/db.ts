// src/lib/db.ts
import { MongoClient, Db } from 'mongodb';
import { ensureIndexes } from './ensureIndexes';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let indexesPromise: Promise<void> | null = null;

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  if (!clientPromise) {
    client = new MongoClient(uri, {
      // Cap connections per instance. On serverless (Vercel) every cold instance
      // opens its own pool, so an unbounded pool can exhaust the Atlas connection
      // limit. Override via MONGODB_MAX_POOL_SIZE if needed.
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const dbName = process.env.MONGODB_DB || 'nutridb';
  const c = await getClient();
  const db = c.db(dbName);

  // Ensure indexes exist once per process. Fire-and-forget so it never blocks
  // the hot path; createIndex is idempotent (no-op when the index exists).
  if (!indexesPromise) {
    indexesPromise = ensureIndexes(db).catch((err) => {
      // Allow a retry on the next getDb() call if the run failed entirely.
      indexesPromise = null;
      console.error('ensureIndexes failed:', err);
    });
  }

  return db;
}
