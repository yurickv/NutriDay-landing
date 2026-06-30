import { describe, it, expect } from 'vitest';
import { sha256 } from 'js-sha256';
import { toGa4Event, hashEmailForGa4 } from './ga4';

describe('toGa4Event', () => {
  it('maps checkout_started to begin_checkout with value/currency', () => {
    expect(toGa4Event('checkout_started', { amount: 99, currency: 'UAH' })).toEqual({
      name: 'begin_checkout',
      params: { value: 99, currency: 'UAH' },
    });
  });
  it('maps payment_succeeded to purchase with transaction_id', () => {
    expect(toGa4Event('payment_succeeded', { amount: 199, currency: 'UAH', orderId: 'ND-month-1' })).toEqual({
      name: 'purchase',
      params: { transaction_id: 'ND-month-1', value: 199, currency: 'UAH' },
    });
  });
  it('passes unknown events through unchanged', () => {
    expect(toGa4Event('onboarding_started', { utm_source: 'instagram' })).toEqual({
      name: 'onboarding_started',
      params: { utm_source: 'instagram' },
    });
  });
  it('defaults currency to UAH', () => {
    expect(toGa4Event('checkout_started', { amount: 50 }).params).toEqual({ value: 50, currency: 'UAH' });
  });
});

describe('hashEmailForGa4', () => {
  it('normalizes case/whitespace then sha256s', () => {
    expect(hashEmailForGa4('  Test@Example.COM ')).toBe(sha256('test@example.com'));
  });
});
