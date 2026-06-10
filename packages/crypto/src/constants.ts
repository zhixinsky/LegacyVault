/** AES-256-GCM 密钥长度（字节） */
export const AES_KEY_LENGTH = 32;

/** GCM 推荐 IV 长度（字节） */
export const GCM_IV_LENGTH = 12;

/** Argon2id 默认 KDF 参数（注册/登录派生 master_key） */
export const DEFAULT_KDF_PARAMS = {
  algorithm: 'argon2id' as const,
  memory: 65536,
  iterations: 3,
  parallelism: 4,
};

/** 验证问题答案哈希参数（较低成本，仍使用 Argon2id） */
export const CHALLENGE_KDF_PARAMS = {
  memory: 16384,
  iterations: 2,
  parallelism: 1,
};

/** 文件分片加密默认块大小：1MB */
export const DEFAULT_FILE_CHUNK_SIZE = 1024 * 1024;

/** 加密载荷格式版本 */
export const CRYPTO_FORMAT_VERSION = 1;
