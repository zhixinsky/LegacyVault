import { encryptBytes, decryptBytes } from './aes/gcm.js';
import { parseCipherPayload, serializeCipherBlock } from './utils/serialize.js';

/** 加密 JSON 对象为字符串密文，每条数据使用独立 IV */
export async function encryptJson<T>(data: T, key: Uint8Array): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await encryptBytes(plaintext, key);
  return JSON.stringify(serializeCipherBlock(encrypted));
}

/** 解密 JSON 密文 */
export async function decryptJson<T>(payload: string, key: Uint8Array): Promise<T> {
  const binary = parseCipherPayload(payload);
  const plaintext = await decryptBytes(binary, key);
  const json = new TextDecoder().decode(plaintext);

  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error('Decryption failed: invalid JSON plaintext');
  }
}
