import { argon2id } from '@noble/hashes/argon2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { AES_KEY_LENGTH, CHALLENGE_KDF_PARAMS } from './constants.js';
import type { ChallengeAnswerHash } from './types.js';
import { base64ToBytes, bytesToBase64, randomBytes, timingSafeEqual } from './utils/encoding.js';

/** 规范化验证问题答案（比较前统一处理，避免大小写/空格差异） */
export function normalizeChallengeAnswer(answer: string): string {
  return answer.trim().toLowerCase();
}

/**
 * 对验证问题答案进行 Argon2id 哈希。
 * 服务器只存储 salt + hash，不存储明文答案。
 */
export function hashChallengeAnswer(answer: string, salt?: Uint8Array | string): ChallengeAnswerHash {
  const normalized = normalizeChallengeAnswer(answer);

  if (!normalized) {
    throw new Error('Challenge answer must not be empty');
  }

  const saltBytes =
    typeof salt === 'string' ? base64ToBytes(salt) : (salt ?? randomBytes(16));

  const hash = argon2id(utf8ToBytes(normalized), saltBytes, {
    t: CHALLENGE_KDF_PARAMS.iterations,
    m: CHALLENGE_KDF_PARAMS.memory,
    p: CHALLENGE_KDF_PARAMS.parallelism,
    dkLen: AES_KEY_LENGTH,
  });

  return {
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(hash),
  };
}

/** 校验验证问题答案是否与存储的哈希匹配 */
export function verifyChallengeAnswer(
  answer: string,
  stored: ChallengeAnswerHash,
): boolean {
  const computed = hashChallengeAnswer(answer, stored.salt);
  return timingSafeEqual(
    base64ToBytes(computed.hash),
    base64ToBytes(stored.hash),
  );
}
