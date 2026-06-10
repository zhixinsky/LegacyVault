import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  decryptFile,
  decryptJson,
  decryptVaultKey,
  deriveMasterKeyByPassword,
  encryptFile,
  encryptJson,
  encryptVaultKey,
  generateFileKey,
  generateVaultKey,
  hashChallengeAnswer,
  randomBytes,
  verifyChallengeAnswer,
} from './index.js';

describe('deriveMasterKeyByPassword', () => {
  it('derives deterministic master key with same salt', () => {
    const salt = randomBytes(16);
    const a = deriveMasterKeyByPassword('MySecurePassword!', salt);
    const b = deriveMasterKeyByPassword('MySecurePassword!', salt);

    expect(bytesToBase64(a.masterKey)).toBe(bytesToBase64(b.masterKey));
    expect(a.kdfParams.algorithm).toBe('argon2id');
  });

  it('derives different keys for different passwords', () => {
    const salt = randomBytes(16);
    const a = deriveMasterKeyByPassword('password-a', salt);
    const b = deriveMasterKeyByPassword('password-b', salt);

    expect(bytesToBase64(a.masterKey)).not.toBe(bytesToBase64(b.masterKey));
  });
});

describe('vault key lifecycle', () => {
  it('encrypts and decrypts vault key with master key', async () => {
    const { masterKey } = deriveMasterKeyByPassword('vault-master-password');
    const vaultKey = generateVaultKey();

    const encrypted = await encryptVaultKey(vaultKey, masterKey);
    const decrypted = await decryptVaultKey(encrypted, masterKey);

    expect(bytesToBase64(decrypted)).toBe(bytesToBase64(vaultKey));
  });

  it('fails decryption with wrong master key', async () => {
    const a = deriveMasterKeyByPassword('correct-password');
    const b = deriveMasterKeyByPassword('wrong-password');
    const vaultKey = generateVaultKey();
    const encrypted = await encryptVaultKey(vaultKey, a.masterKey);

    await expect(decryptVaultKey(encrypted, b.masterKey)).rejects.toThrow(
      'Decryption failed',
    );
  });
});

describe('encryptJson / decryptJson', () => {
  it('round-trips structured data', async () => {
    const key = generateVaultKey();
    const payload = {
      platform: 'github',
      username: 'user@example.com',
      password: 'secret-password',
    };

    const encrypted = await encryptJson(payload, key);
    const decrypted = await decryptJson<typeof payload>(encrypted, key);

    expect(decrypted).toEqual(payload);
  });

  it('uses unique IV per encryption', async () => {
    const key = generateVaultKey();
    const data = { note: 'same content' };

    const first = await encryptJson(data, key);
    const second = await encryptJson(data, key);

    expect(first).not.toBe(second);
  });
});

describe('encryptFile / decryptFile', () => {
  it('round-trips small file', async () => {
    const fileKey = generateFileKey();
    const original = new TextEncoder().encode('hello vaultpass file');

    const encrypted = await encryptFile(original, fileKey);
    const decrypted = await decryptFile(encrypted, fileKey);

    expect(decrypted).toEqual(original);
  });

  it('round-trips multi-chunk file', async () => {
    const fileKey = generateFileKey();
    const original = randomBytes(5000);

    const encrypted = await encryptFile(original, fileKey, 1024);
    const parsed = JSON.parse(encrypted) as { chunks: unknown[] };

    expect(parsed.chunks.length).toBeGreaterThan(1);

    const decrypted = await decryptFile(encrypted, fileKey);
    expect(decrypted).toEqual(original);
  });

  it('round-trips empty file', async () => {
    const fileKey = generateFileKey();
    const original = new Uint8Array(0);

    const encrypted = await encryptFile(original, fileKey);
    const decrypted = await decryptFile(encrypted, fileKey);

    expect(decrypted).toEqual(original);
  });
});

describe('hashChallengeAnswer', () => {
  it('hashes and verifies normalized answers', () => {
    const stored = hashChallengeAnswer('  Beijing  ');
    expect(verifyChallengeAnswer('beijing', stored)).toBe(true);
    expect(verifyChallengeAnswer('Shanghai', stored)).toBe(false);
  });

  it('uses provided salt for deterministic hashing', () => {
    const salt = randomBytes(16);
    const a = hashChallengeAnswer('answer', salt);
    const b = hashChallengeAnswer('answer', salt);

    expect(a.hash).toBe(b.hash);
    expect(a.salt).toBe(b.salt);
  });
});

describe('encoding utils', () => {
  it('round-trips base64', () => {
    const original = randomBytes(32);
    expect(base64ToBytes(bytesToBase64(original))).toEqual(original);
  });
});

describe('generateVaultKey / generateFileKey', () => {
  it('generates 32-byte keys', () => {
    expect(generateVaultKey()).toHaveLength(32);
    expect(generateFileKey()).toHaveLength(32);
  });
});
