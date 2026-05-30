// src/lib/ensureIndexes.ts
//
// Idempotent index creation. `createIndex` is a no-op when an identical index
// already exists, so this is safe to run on every cold start (it is wired to
// run once per process from getDb()). Each spec is created independently so a
// single failure (e.g. a unique index blocked by pre-existing duplicates) is
// logged but does not prevent the remaining indexes from being created.
import { Db, IndexSpecification, CreateIndexesOptions } from 'mongodb';

type IndexSpec = {
  collection: string;
  keys: IndexSpecification;
  options?: CreateIndexesOptions;
};

const INDEXES: IndexSpec[] = [
  // --- Auth / hot path -----------------------------------------------------
  { collection: 'sessions', keys: { id: 1 } },
  // TTL: expired sessions are removed automatically (expiresAt is a real Date).
  { collection: 'sessions', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'magic_links', keys: { tokenHash: 1 } },
  { collection: 'magic_links', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },

  // --- Users / subscriptions ----------------------------------------------
  { collection: 'users', keys: { email: 1 }, options: { unique: true } },
  { collection: 'users', keys: { orderId: 1 } },
  { collection: 'subscriptions', keys: { userId: 1 }, options: { unique: true } },

  // --- Profile & engagement ------------------------------------------------
  { collection: 'user_profiles', keys: { userEmail: 1 }, options: { unique: true } },
  { collection: 'user_streaks', keys: { userEmail: 1 }, options: { unique: true } },
  { collection: 'weekly_menus', keys: { userEmail: 1, status: 1, createdAt: -1 } },
  // TTL: archived menus carry `archivedAt`; purge them 60 days after archival.
  // Active menus have no `archivedAt`, so the TTL monitor never touches them.
  {
    collection: 'weekly_menus',
    keys: { archivedAt: 1 },
    options: { expireAfterSeconds: 60 * 24 * 60 * 60 },
  },
  { collection: 'shopping_lists', keys: { userEmail: 1, weekStartDate: -1 } },
  { collection: 'weight_logs', keys: { userEmail: 1, date: -1 } },
  { collection: 'water_logs', keys: { userEmail: 1, date: 1 } },
  { collection: 'favorite_meals', keys: { userEmail: 1, savedAt: -1 } },
  { collection: 'favorite_meals', keys: { userEmail: 1, 'meal.name': 1 } },
  { collection: 'push_subscriptions', keys: { userEmail: 1, endpoint: 1 }, options: { unique: true } },
  { collection: 'tips', keys: { isActive: 1, category: 1 } },

  // --- Phase A infra -------------------------------------------------------
  // Rate-limit buckets self-expire once their window passes.
  { collection: 'rate_limits', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  // Payment idempotency: identical LiqPay callbacks share a signature.
  { collection: 'payment_events', keys: { signature: 1 }, options: { unique: true } },
];

export async function ensureIndexes(db: Db): Promise<void> {
  for (const spec of INDEXES) {
    try {
      await db.collection(spec.collection).createIndex(spec.keys, spec.options);
    } catch (err) {
      console.error(
        `ensureIndexes: ${spec.collection} ${JSON.stringify(spec.keys)} failed:`,
        (err as Error)?.message ?? err
      );
    }
  }
}
