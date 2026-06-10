import { encryptBytes, decryptBytes } from './aes/gcm.js';
import { CRYPTO_FORMAT_VERSION, DEFAULT_FILE_CHUNK_SIZE } from './constants.js';
import type { EncryptedFilePayload } from './types.js';
import { bytesToBase64, base64ToBytes } from './utils/encoding.js';
import { parseEncryptedFilePayload, serializeEncryptedFile } from './utils/serialize.js';

/**
 * 分片加密文件。
 * 每个分片使用独立 IV，防止大文件一次性加载内存。
 */
export async function encryptFile(
  file: Uint8Array | ArrayBuffer,
  fileKey: Uint8Array,
  chunkSize = DEFAULT_FILE_CHUNK_SIZE,
): Promise<string> {
  const data = file instanceof Uint8Array ? file : new Uint8Array(file);

  if (chunkSize <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }

  const chunks = [];
  let index = 0;

  for (let offset = 0; offset < data.length; offset += chunkSize) {
    const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
    const encrypted = await encryptBytes(slice, fileKey);

    chunks.push({
      index,
      iv: bytesToBase64(encrypted.iv),
      data: bytesToBase64(encrypted.ciphertext),
    });
    index += 1;
  }

  if (chunks.length === 0) {
    const encrypted = await encryptBytes(new Uint8Array(0), fileKey);
    chunks.push({
      index: 0,
      iv: bytesToBase64(encrypted.iv),
      data: bytesToBase64(encrypted.ciphertext),
    });
  }

  const payload: EncryptedFilePayload = {
    v: CRYPTO_FORMAT_VERSION,
    alg: 'AES-GCM',
    chunkSize,
    totalSize: data.length,
    chunks,
  };

  return serializeEncryptedFile(payload);
}

/** 解密分片加密的文件，还原为原始字节 */
export async function decryptFile(payload: string, fileKey: Uint8Array): Promise<Uint8Array> {
  const parsed = parseEncryptedFilePayload(payload);
  const orderedChunks = [...parsed.chunks].sort((a, b) => a.index - b.index);

  const parts: Uint8Array[] = [];
  for (const chunk of orderedChunks) {
    const part = await decryptBytes(
      {
        iv: base64ToBytes(chunk.iv),
        ciphertext: base64ToBytes(chunk.data),
      },
      fileKey,
    );
    parts.push(part);
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  if (result.length !== parsed.totalSize) {
    throw new Error('Decryption failed: restored size mismatch');
  }

  return result;
}
