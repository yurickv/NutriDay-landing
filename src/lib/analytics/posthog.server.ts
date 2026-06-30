import { PostHog } from 'posthog-node';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from './payment';

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
  timestamp?: Date;
}

export function buildPaymentCaptureArgs(input: PaymentCaptureInput): PaymentCaptureArgs {
  const { ts } = parseOrderId(input.orderId);
  const insertId =
    input.event === 'payment_succeeded'
      ? paymentSuccessInsertId(input.orderId)
      : paymentFailedInsertId(input.orderId);

  return {
    distinctId: input.email,
    event: input.event,
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
    timestamp: ts ? new Date(ts) : undefined,
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
