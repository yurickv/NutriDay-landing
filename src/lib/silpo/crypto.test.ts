import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { encryptSecret, decryptSecret } from './crypto';

describe('silpo crypto', () => {
  beforeAll(() => {
    process.env.SILPO_TOKEN_ENC_KEY = crypto.randomBytes(32).toString('base64');
  });

  it('round-trips a secret', () => {
    const enc = encryptSecret('my-token');
    expect(enc).not.toContain('my-token');
    expect(decryptSecret(enc)).toBe('my-token');
  });

  it('uses a fresh IV each time', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('rejects tampered payloads', () => {
    const enc = encryptSecret('secret');
    const [iv, tag, data] = enc.split('.');
    const flipped = Buffer.from(data, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });

  it('throws when the key is missing', () => {
    const saved = process.env.SILPO_TOKEN_ENC_KEY;
    delete process.env.SILPO_TOKEN_ENC_KEY;
    expect(() => encryptSecret('x')).toThrow(/SILPO_TOKEN_ENC_KEY/);
    process.env.SILPO_TOKEN_ENC_KEY = saved;
  });
});
