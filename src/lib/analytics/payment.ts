export interface ParsedOrder {
  plan: string | null;
  ts: number | null;
}

export function parseOrderId(orderId: string): ParsedOrder {
  const match = /^ND-([a-z]+)-(\d+)$/i.exec((orderId || '').trim());
  if (!match) return { plan: null, ts: null };
  return { plan: match[1], ts: Number(match[2]) };
}

export function paymentSuccessInsertId(orderId: string): string {
  return `pay_success:${orderId}`;
}

export function paymentFailedInsertId(orderId: string): string {
  return `pay_failed:${orderId}`;
}
