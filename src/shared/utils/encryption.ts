import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.TENANT_SECRET_ENCRYPTION_KEY;
  if (!hex) throw new Error('TENANT_SECRET_ENCRYPTION_KEY env var is not set');
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('TENANT_SECRET_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  return key;
}

/**
 * Encrypts a plaintext string.
 * Returns a colon-separated string: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(stored: string): string {
  const key = getKey();
  const parts = stored.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
