import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.SILPO_TOKEN_ENC_KEY;
  if (!raw) throw new Error('SILPO_TOKEN_ENC_KEY is missing');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SILPO_TOKEN_ENC_KEY must decode to 32 bytes');
  return key;
}

/** Returns `iv.tag.ciphertext`, each part base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted payload');
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
