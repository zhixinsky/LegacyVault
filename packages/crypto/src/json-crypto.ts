import { encryptBytes, decryptBytes } from './aes/gcm.js';
import { bytesToUtf8, utf8ToBytes } from './utils/encoding.js';
import { parseCipherPayload, serializeCipherBlock } from './utils/serialize.js';

/** 加密 JSON 对象为字符串密文，每条数据使用独立 IV */
export async function encryptJson<T>(data: T, key: Uint8Array): Promise<string> {
  const plaintext = utf8ToBytes(JSON.stringify(data));
  const encrypted = await encryptBytes(plaintext, key);
  return JSON.stringify(serializeCipherBlock(encrypted));
}

/** 解密 JSON 密文 */
export async function decryptJson<T>(payload: string, key: Uint8Array): Promise<T> {
  const binary = parseCipherPayload(payload);
  const plaintext = await decryptBytes(binary, key);
  const json = bytesToUtf8(plaintext);

  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error('Decryption failed: invalid JSON plaintext');
  }
}
