import { deriveMasterKeyByPassword } from './kdf/derive-master-key.js';
import { encryptVaultKey } from './vault-crypto.js';
import { generateVaultKey as createVaultKey } from './vault-key.js';
import type { DerivedMasterKey, KdfParams } from './types.js';
import { randomBytes } from './utils/encoding.js';

export type PasswordStrengthLevel = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface PasswordStrengthResult {
  level: PasswordStrengthLevel;
  score: number;
  label: '弱' | '中' | '强' | '非常强';
  color: 'red' | 'orange' | 'green' | 'blue';
  valid: boolean;
  rules: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
    notWeak: boolean;
  };
}

const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const WEAK_PASSWORDS = ['123456', 'password', 'qwerty', '88888888'];

export function generateVaultKey() {
  return createVaultKey();
}

export function generateRecoveryKey() {
  const bytes = randomBytes(24);
  const chars = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]);
  return Array.from({ length: 6 }, (_, index) => chars.slice(index * 4, index * 4 + 4).join('')).join('-');
}

export function deriveMasterKey(
  password: string,
  salt?: Uint8Array | string,
  params?: Partial<KdfParams>,
): DerivedMasterKey {
  return deriveMasterKeyByPassword(password, salt, params);
}

export function deriveRecoveryKey(
  recoveryKey: string,
  salt?: Uint8Array | string,
  params?: Partial<KdfParams>,
): DerivedMasterKey {
  return deriveMasterKeyByPassword(normalizeRecoveryKey(recoveryKey), salt, params);
}

export function encryptVaultKeyByRecovery(vaultKey: Uint8Array, recoveryDerivedKey: Uint8Array) {
  return encryptVaultKey(vaultKey, recoveryDerivedKey);
}

export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  const rules = {
    minLength: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    notWeak: !isWeakPassword(password),
  };

  let score = Object.values(rules).filter(Boolean).length;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;
  if (/(.)\1{2,}/.test(password)) score -= 1;

  const valid = Object.values(rules).every(Boolean);
  if (!valid) score = Math.min(score, 2);

  if (score >= 7) {
    return { level: 'very-strong', score, label: '非常强', color: 'blue', valid, rules };
  }
  if (score >= 6) {
    return { level: 'strong', score, label: '强', color: 'green', valid, rules };
  }
  if (score >= 3) {
    return { level: 'medium', score, label: '中', color: 'orange', valid, rules };
  }
  return { level: 'weak', score, label: '弱', color: 'red', valid, rules };
}

function normalizeRecoveryKey(recoveryKey: string) {
  return recoveryKey.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}

function isWeakPassword(password: string) {
  const normalized = password.toLowerCase();
  if (WEAK_PASSWORDS.some((weak) => normalized.includes(weak))) {
    return true;
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 8 && hasBirthdayLikeSequence(digits)) {
    return true;
  }
  return hasLongSequentialDigits(digits);
}

function hasLongSequentialDigits(digits: string) {
  if (digits.length < 6) return false;
  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  for (let length = 6; length <= digits.length; length += 1) {
    for (let index = 0; index + length <= digits.length; index += 1) {
      const chunk = digits.slice(index, index + length);
      if (ascending.includes(chunk) || descending.includes(chunk)) {
        return true;
      }
    }
  }
  return false;
}

function hasBirthdayLikeSequence(digits: string) {
  return /(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/.test(digits);
}
