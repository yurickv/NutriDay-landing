import crypto from 'crypto';

// LiqPay returns the buyer to `result_url` with a POST form (`data`,
// `signature`), the same shape as the server_url webhook. A statically
// prerendered Next.js page answers POST with 405, so the buyer never reaches
// the result screen. `/api/liqpay/result` accepts that POST, verifies the
// signature and 303-redirects to the client page with order_id/status in the
// query string.

export interface LiqpayResultPayload {
  order_id?: string;
  status?: string;
  [k: string]: unknown;
}

export function verifyLiqpaySignature(
  privateKey: string,
  data: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHash('sha1')
    .update(privateKey + data + privateKey)
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function decodeLiqpayData(data: string): LiqpayResultPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as LiqpayResultPayload) : null;
  } catch {
    return null;
  }
}

export function buildResultRedirectPath(payload: LiqpayResultPayload | null): string {
  const qs = new URLSearchParams();
  if (payload?.order_id && typeof payload.order_id === 'string') {
    qs.set('order_id', payload.order_id);
  }
  if (payload?.status && typeof payload.status === 'string') {
    qs.set('status', payload.status);
  }
  const query = qs.toString();
  return query ? `/payment/result?${query}` : '/payment/result';
}
