import { CRYPTO_FORMAT_VERSION } from '../constants.js';
import type {
  EncryptedBinary,
  EncryptedFilePayload,
  SerializedCipherPayload,
} from '../types.js';
import { base64ToBytes, bytesToBase64 } from './encoding.js';

export function serializeCipherBlock(block: EncryptedBinary): SerializedCipherPayload {
  return {
    v: CRYPTO_FORMAT_VERSION,
    alg: 'AES-GCM',
    iv: bytesToBase64(block.iv),
    data: bytesToBase64(block.ciphertext),
  };
}

export function parseCipherPayload(payload: string): EncryptedBinary {
  let parsed: SerializedCipherPayload;

  try {
    parsed = JSON.parse(payload) as SerializedCipherPayload;
  } catch {
    throw new Error('Invalid encrypted payload: malformed JSON');
  }

  if (parsed.v !== CRYPTO_FORMAT_VERSION || parsed.alg !== 'AES-GCM') {
    throw new Error('Unsupported encrypted payload format');
  }

  if (!parsed.iv || !parsed.data) {
    throw new Error('Invalid encrypted payload: missing fields');
  }

  return {
    iv: base64ToBytes(parsed.iv),
    ciphertext: base64ToBytes(parsed.data),
  };
}

export function parseEncryptedFilePayload(payload: string): EncryptedFilePayload {
  let parsed: EncryptedFilePayload;

  try {
    parsed = JSON.parse(payload) as EncryptedFilePayload;
  } catch {
    throw new Error('Invalid encrypted file payload: malformed JSON');
  }

  if (parsed.v !== CRYPTO_FORMAT_VERSION || parsed.alg !== 'AES-GCM') {
    throw new Error('Unsupported encrypted file format');
  }

  if (!Array.isArray(parsed.chunks) || parsed.chunks.length === 0) {
    throw new Error('Invalid encrypted file payload: no chunks');
  }

  return parsed;
}

export function serializeEncryptedFile(payload: EncryptedFilePayload): string {
  return JSON.stringify(payload);
}
