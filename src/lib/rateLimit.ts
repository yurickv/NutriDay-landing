// src/lib/rateLimit.ts
//
// Serverless-safe rate limiting backed by MongoDB (shared state across all
// instances). Fixed-window counter: each (key, window) bucket is a single
// document that self-expires via the TTL index on `expiresAt` (see
// ensureIndexes.ts). When higher throughput is needed this can be swapped for
// Redis/Upstash behind the same checkRateLimit() signature.
import { NextResponse } from 'next/server';
import { getDb } from './db';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Increments the counter for `key` within the current fixed window and reports
 * whether the request is allowed. Fails OPEN: a limiter/DB error never blocks a
 * legitimate request.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const db = await getDb();
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const windowEndMs = (bucket + 1) * windowMs;
    const id = `${key}:${bucket}`;

    const doc = await db.collection('rate_limits').findOneAndUpdate(
      { _id: id as unknown as never },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(windowEndMs) },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const count = (doc as { count?: number } | null)?.count ?? 1;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil((windowEndMs - now) / 1000)),
    };
  } catch (err) {
    console.error('rateLimit error:', err);
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP extraction (Vercel sets x-forwarded-for). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequestsResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Забагато запитів. Спробуйте трохи пізніше.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)) },
    }
  );
}
