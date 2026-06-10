import { AES_KEY_LENGTH, GCM_IV_LENGTH } from '../constants.js';
import type { EncryptedBinary } from '../types.js';
import { randomBytes } from '../utils/encoding.js';

function asBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importAesKey(rawKey: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  if (rawKey.length !== AES_KEY_LENGTH) {
    throw new Error(`AES-256 key must be ${AES_KEY_LENGTH} bytes`);
  }

  return crypto.subtle.importKey(
    'raw',
    asBufferSource(rawKey),
    { name: 'AES-GCM' },
    false,
    usages,
  );
}

/**
 * 使用 AES-256-GCM 加密字节。
 * 每次调用生成独立随机 IV，禁止复用。
 */
export async function encryptBytes(plaintext: Uint8Array, key: Uint8Array): Promise<EncryptedBinary> {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cryptoKey = await importAesKey(key, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      cryptoKey,
      asBufferSource(plaintext),
    ),
  );

  return { iv, ciphertext };
}

/** 使用 AES-256-GCM 解密字节 */
export async function decryptBytes(payload: EncryptedBinary, key: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await importAesKey(key, ['decrypt']);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(payload.iv) },
      cryptoKey,
      asBufferSource(payload.ciphertext),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error('Decryption failed: invalid key or corrupted ciphertext');
  }
}
