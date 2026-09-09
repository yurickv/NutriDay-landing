import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  verifyLiqpaySignature,
  decodeLiqpayData,
  buildResultRedirectPath,
} from './resultRedirect';

const PRIVATE_KEY = 'test_private_key';
const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64');
const sign = (data: string) =>
  crypto.createHash('sha1').update(PRIVATE_KEY + data + PRIVATE_KEY).digest('base64');

describe('verifyLiqpaySignature', () => {
  it('accepts a signature built as sha1(private + data + private)', () => {
    const data = encode({ order_id: 'ND-week-1', status: 'success' });
    expect(verifyLiqpaySignature(PRIVATE_KEY, data, sign(data))).toBe(true);
  });
  it('rejects a tampered payload', () => {
    const data = encode({ order_id: 'ND-week-1', status: 'success' });
    const tampered = encode({ order_id: 'ND-week-1', status: 'failure' });
    expect(verifyLiqpaySignature(PRIVATE_KEY, tampered, sign(data))).toBe(false);
  });
  it('rejects a signature of a different length without throwing', () => {
    const data = encode({ order_id: 'ND-week-1' });
    expect(verifyLiqpaySignature(PRIVATE_KEY, data, 'short')).toBe(false);
  });
});

describe('decodeLiqpayData', () => {
  it('decodes base64 JSON', () => {
    expect(decodeLiqpayData(encode({ order_id: 'ND-week-1', status: 'success' }))).toEqual({
      order_id: 'ND-week-1',
      status: 'success',
    });
  });
  it('returns null for garbage', () => {
    expect(decodeLiqpayData('%%%not-base64-json')).toBeNull();
  });
});

describe('buildResultRedirectPath', () => {
  it('carries order_id and status into the result page query', () => {
    expect(buildResultRedirectPath({ order_id: 'ND-week-1', status: 'success' })).toBe(
      '/payment/result?order_id=ND-week-1&status=success',
    );
  });
  it('omits missing fields', () => {
    expect(buildResultRedirectPath({ order_id: 'ND-week-1' })).toBe('/payment/result?order_id=ND-week-1');
    expect(buildResultRedirectPath({})).toBe('/payment/result');
    expect(buildResultRedirectPath(null)).toBe('/payment/result');
  });
  it('url-encodes values', () => {
    expect(buildResultRedirectPath({ order_id: 'a b', status: 'wait_secure' })).toBe(
      '/payment/result?order_id=a+b&status=wait_secure',
    );
  });
});
