import type { KdfParams } from '@vaultpass/types';

export type { KdfParams };

/** AES-GCM 加密后的二进制载荷 */
export interface EncryptedBinary {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

/** 可序列化的 AES-GCM 密文块 */
export interface SerializedCipherBlock {
  iv: string;
  data: string;
}

/** 序列化后的 JSON/密钥密文 */
export interface SerializedCipherPayload extends SerializedCipherBlock {
  v: number;
  alg: 'AES-GCM';
}

/** 文件分片密文 */
export interface EncryptedFileChunk extends SerializedCipherBlock {
  index: number;
}

/** 分片加密后的文件结构 */
export interface EncryptedFilePayload {
  v: number;
  alg: 'AES-GCM';
  chunkSize: number;
  totalSize: number;
  chunks: EncryptedFileChunk[];
}

/** 主密码派生结果 — masterKey 仅应保存在内存，禁止写入 localStorage */
export interface DerivedMasterKey {
  masterKey: Uint8Array;
  kdfSalt: string;
  kdfParams: KdfParams;
}

/** 验证问题答案哈希结果 */
export interface ChallengeAnswerHash {
  salt: string;
  hash: string;
}
