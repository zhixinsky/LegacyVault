import {
  getVaultItemTypeConfig,
  MANAGED_VAULT_TYPES,
  type VaultItemType,
} from '@vaultpass/types';
import { decryptFileMetadata, decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import { listFiles, listVaultItems } from '@/utils/services';

export interface VaultSearchResult {
  id: string;
  type: string;
  category: string;
  title: string;
  subtitle?: string;
  route: string;
}

function matchesQuery(parts: Array<string | undefined>, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return parts.some((part) => part?.toLowerCase().includes(normalized));
}

async function searchVaultType(
  type: VaultItemType | 'note',
  category: string,
  route: string,
  query: string,
): Promise<VaultSearchResult[]> {
  const result = await listVaultItems(type);
  const rows: VaultSearchResult[] = [];

  for (const item of result.items) {
    try {
      const title = await decryptVaultTitle(item.titleCiphertext);
      const payload = await decryptVaultPayload<Record<string, string>>(item.encryptedPayload);
      const subtitle = Object.values(payload).find((value) => value && value.length <= 80);

      if (matchesQuery([title, subtitle, ...Object.values(payload)], query)) {
        rows.push({
          id: item.id,
          type,
          category,
          title,
          subtitle,
          route,
        });
      }
    } catch {
      // Skip corrupted or no-longer-compatible encrypted rows so one bad item does not break search.
    }
  }

  return rows;
}

export async function searchVaultItems(query: string): Promise<VaultSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const fileResults = await searchFiles(trimmed);

  const groups = await Promise.all([
    searchVaultType('password', '账号密码', '/pages/passwords/passwords', trimmed),
    searchVaultType('note', '私密笔记', '/pages/notes/notes', trimmed),
    ...MANAGED_VAULT_TYPES.map((type) => {
      const config = getVaultItemTypeConfig(type);
      return searchVaultType(
        type,
        config?.label ?? type,
        `/pages/accounts/accounts?type=${type}`,
        trimmed,
      );
    }),
  ]);

  return [...groups.flat(), ...fileResults];
}

async function searchFiles(query: string): Promise<VaultSearchResult[]> {
  const result = await listFiles();
  const rows: VaultSearchResult[] = [];

  for (const file of result.items) {
    try {
      const meta = await decryptFileMetadata(file.encryptedMetadata);
      const title = meta.displayName || file.fileType;
      const subtitle = meta.tags || meta.note || file.mimeType;

      if (matchesQuery([title, meta.tags, meta.note, file.mimeType, file.fileType], query)) {
        rows.push({
          id: file.id,
          type: 'file',
          category: file.albumId ? '相册文件' : '加密文件',
          title,
          subtitle,
          route: file.albumId ? '/pages/albums/albums' : '/pages/upload-file/upload-file',
        });
      }
    } catch {
      // Ignore files whose encrypted metadata cannot be decrypted in the current vault session.
    }
  }

  return rows;
}
