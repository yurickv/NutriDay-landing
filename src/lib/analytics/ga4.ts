import { sha256 } from 'js-sha256';

export interface Ga4Event {
  name: string;
  params: Record<string, unknown>;
}

export function toGa4Event(
  event: string,
  props: Record<string, unknown> = {},
): Ga4Event {
  switch (event) {
    case 'checkout_started':
      return {
        name: 'begin_checkout',
        params: { value: props.amount, currency: (props.currency as string) ?? 'UAH' },
      };
    case 'payment_succeeded':
      return {
        name: 'purchase',
        params: {
          transaction_id: props.orderId,
          value: props.amount,
          currency: (props.currency as string) ?? 'UAH',
        },
      };
    default:
      return { name: event, params: props };
  }
}

export function hashEmailForGa4(email: string): string {
  return sha256(email.trim().toLowerCase());
}
