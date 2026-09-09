import crypto from 'crypto';
import { PostHog } from 'posthog-node';
import { paymentSuccessInsertId, paymentFailedInsertId } from './payment';

export interface PaymentCaptureInput {
  email: string;
  event: 'payment_succeeded' | 'payment_failed';
  orderId: string;
  plan?: string | null;
  amount?: number;
  currency?: string;
  utmSource?: string | null;
  status?: string;
}

export interface PaymentCaptureArgs {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
  /** Deterministic per order: PostHog deduplicates on uuid, so webhook
   *  retries and the callback/status-poll race collapse into one event. */
  uuid: string;
  timestamp?: Date;
}

// Fixed namespace for RFC 4122 v5 UUIDs derived from our insert ids.
const UUID_NAMESPACE = Buffer.from('3f6c1c2e8a4b4d5e9f10a1b2c3d4e5f6', 'hex');

/** RFC 4122 v5-shaped UUID (sha1 of namespace + name): stable for the same input. */
export function deterministicUuid(name: string): string {
  const hash = crypto
    .createHash('sha1')
    .update(Buffer.concat([UUID_NAMESPACE, Buffer.from(name, 'utf8')]))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function buildPaymentCaptureArgs(input: PaymentCaptureInput): PaymentCaptureArgs {
  const insertId =
    input.event === 'payment_succeeded'
      ? paymentSuccessInsertId(input.orderId)
      : paymentFailedInsertId(input.orderId);

  // No timestamp override: the event must carry the real confirmation time.
  // Backdating it to the orderId creation time placed payment_succeeded BEFORE
  // checkout_started / redirected_to_liqpay, so ordered funnels in PostHog did
  // not count the conversion.
  return {
    distinctId: input.email,
    event: input.event,
    uuid: deterministicUuid(insertId),
    properties: {
      $insert_id: insertId,
      plan: input.plan ?? null,
      amount: input.amount,
      currency: input.currency ?? 'UAH',
      utm_source: input.utmSource ?? null,
      status: input.status ?? null,
      orderId: input.orderId,
      env: process.env.NEXT_PUBLIC_ANALYTICS_ENV || 'prod',
    },
  };
}

export async function capturePaymentEvent(input: PaymentCaptureInput): Promise<void> {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return; // local/dev — no server capture
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    client.capture(buildPaymentCaptureArgs(input));
    await client.flush();
  } catch (err) {
    console.error('[analytics] server payment capture failed', err);
  } finally {
    await client.shutdown();
  }
}
