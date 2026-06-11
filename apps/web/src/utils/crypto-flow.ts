import { sha256 } from '@noble/hashes/sha2';
import {
  base64ToBytes,
  bytesToBase64,
  decryptFile,
  decryptJson,
  decryptVaultKey,
  deriveMasterKey,
  deriveRecoveryKey as deriveRecoveryKeyByPhrase,
  deriveMasterKeyByPassword,
  encryptFile,
  encryptJson,
  encryptVaultKey,
  encryptVaultKeyByRecovery,
  generateFileKey,
  generateRecoveryKey,
  generateVaultKey,
  hashChallengeAnswer,
  normalizeChallengeAnswer,
} from '@vaultpass/crypto';
import type { FileMetadata } from '@vaultpass/types';
import { vaultSession } from '@/utils/api';

export async function registerWithMasterPassword(phone: string, masterPassword: string) {
  const derived = deriveMasterKeyByPassword(masterPassword);
  const vaultKey = generateVaultKey();
  const encryptedVaultKey = await encryptVaultKey(vaultKey, derived.masterKey);

  return {
    vaultKey,
    registerPayload: {
      phone,
      encryptedVaultKey,
      kdfSalt: derived.kdfSalt,
      kdfParams: derived.kdfParams,
    },
  };
}

export async function buildCreateVaultPayload(masterPassword: string) {
  const vaultKey = generateVaultKey();
  const recoveryKey = generateRecoveryKey();
  const master = deriveMasterKey(masterPassword);
  const recovery = deriveRecoveryKeyByPhrase(recoveryKey);
  const encryptedVaultKey = await encryptVaultKey(vaultKey, master.masterKey);
  const encryptedVaultKeyByRecovery = await encryptVaultKeyByRecovery(
    vaultKey,
    recovery.masterKey,
  );

  return {
    vaultKey,
    recoveryKey,
    keyBundle: {
      encryptedVaultKey,
      kdfSalt: master.kdfSalt,
      kdfParams: master.kdfParams,
    },
    recoveryBundle: encryptedVaultKeyByRecovery,
    createPayload: {
      encryptedVaultKey,
      encryptedVaultKeyByRecovery,
      passwordSalt: master.kdfSalt,
      recoverySalt: recovery.kdfSalt,
      kdfParams: master.kdfParams,
    },
  };
}

export async function unlockVaultWithMasterPassword(masterPassword: string) {
  const bundle = vaultSession.getKeyBundle();
  if (!bundle) {
    throw new Error('缺少密钥包，请重新登录');
  }

  const derived = deriveMasterKeyByPassword(
    masterPassword,
    bundle.kdfSalt,
    bundle.kdfParams,
  );
  const vaultKey = await decryptVaultKey(bundle.encryptedVaultKey, derived.masterKey);
  vaultSession.setVaultKey(vaultKey);
  return vaultKey;
}

export async function encryptVaultItemPayload(payload: Record<string, string>, title: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return {
    titleCiphertext: await encryptJson({ title }, vaultKey),
    encryptedPayload: await encryptJson(payload, vaultKey),
  };
}

export async function decryptVaultTitle(titleCiphertext: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const data = await decryptJson<{ title: string }>(titleCiphertext, vaultKey);
  return data.title;
}

export async function decryptVaultPayload<T extends Record<string, string>>(encryptedPayload: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return decryptJson<T>(encryptedPayload, vaultKey);
}

export async function encryptField(value: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson({ value }, vaultKey);
}

export async function encryptFileMetadata(metadata: FileMetadata) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson(metadata, vaultKey);
}

export async function decryptFileMetadata(ciphertext?: string | null): Promise<FileMetadata> {
  if (!ciphertext) {
    return {};
  }
  const vaultKey = vaultSession.requireVaultKey();
  return decryptJson<FileMetadata>(ciphertext, vaultKey);
}

export async function prepareEncryptedUpload(
  file: File,
  fileType: string,
  albumId?: string,
  metadata?: FileMetadata,
) {
  const vaultKey = vaultSession.requireVaultKey();
  const fileData = new Uint8Array(await file.arrayBuffer());
  const fileKey = generateFileKey();
  const encryptedContent = await encryptFile(fileData, fileKey);
  const encryptedFileKey = await encryptJson({ key: bytesToBase64(fileKey) }, vaultKey);
  const encryptedBytes = new TextEncoder().encode(encryptedContent);

  return {
    blob: new Blob([encryptedContent], { type: 'application/octet-stream' }),
    formData: {
      fileType,
      encryptedFileKey,
      fileHash: bytesToBase64(sha256(encryptedBytes)),
      fileSize: encryptedBytes.length,
      mimeType: file.type || 'application/octet-stream',
      ...(albumId ? { albumId } : {}),
      ...(metadata && (metadata.displayName || metadata.tags || metadata.note)
        ? { encryptedMetadata: await encryptFileMetadata(metadata) }
        : {}),
    },
  };
}

export function computeLookupHash(value: string) {
  const normalized = value.trim().toLowerCase();
  return bytesToBase64(sha256(new TextEncoder().encode(normalized)));
}

function deriveContactKey(answer: string) {
  return sha256(new TextEncoder().encode(normalizeChallengeAnswer(answer)));
}

export async function buildContactTakeoverMaterials(questionLabel: string, answer: string) {
  const vaultKey = vaultSession.requireVaultKey();
  const answerHash = hashChallengeAnswer(answer);
  const encryptedVaultKeyForContact = await encryptJson(
    { vaultKey: bytesToBase64(vaultKey) },
    deriveContactKey(answer),
  );

  return {
    questionLabel,
    encryptedQuestion: await encryptField(questionLabel),
    encryptedAnswerHash: JSON.stringify(answerHash),
    encryptedVaultKeyForContact,
  };
}

export async function decryptStoredFile(
  encryptedContent: string,
  encryptedFileKey: string,
  vaultKey?: Uint8Array,
) {
  const key = vaultKey ?? vaultSession.requireVaultKey();
  const payload = await decryptJson<{ key: string }>(encryptedFileKey, key);
  return decryptFile(encryptedContent, base64ToBytes(payload.key));
}

function deriveRecoveryKey(recoveryPassphrase: string) {
  return sha256(new TextEncoder().encode(normalizeChallengeAnswer(recoveryPassphrase)));
}

export async function buildRecoveryKeyPayload(recoveryPassphrase: string) {
  const vaultKey = vaultSession.requireVaultKey();
  return encryptJson({ vaultKey: bytesToBase64(vaultKey) }, deriveRecoveryKey(recoveryPassphrase));
}

export async function unlockVaultWithRecoveryKey(
  recoveryPassphrase: string,
  encryptedVaultKeyByRecovery: string,
) {
  const payload = await decryptJson<{ vaultKey: string }>(
    encryptedVaultKeyByRecovery,
    deriveRecoveryKey(recoveryPassphrase),
  );
  const vaultKey = base64ToBytes(payload.vaultKey);
  vaultSession.setVaultKey(vaultKey);
  return vaultKey;
}

export async function decryptContactVaultKey(encryptedVaultKeyForContact: string, answer: string) {
  const payload = await decryptJson<{ vaultKey: string }>(
    encryptedVaultKeyForContact,
    deriveContactKey(answer),
  );
  return base64ToBytes(payload.vaultKey);
}
