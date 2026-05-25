// src/lib/db.ts
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing');
  }

  if (!clientPromise) {
    client = new MongoClient(uri);
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
  return c.db(dbName);
}
