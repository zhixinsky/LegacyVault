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
    searchVaultType('email_account', '账号密码', '/app/passwords', trimmed),
    searchVaultType('server_account', '账号密码', '/app/passwords', trimmed),
    searchVaultType('note', '私密笔记', '/app/notes', trimmed),
    ...MANAGED_VAULT_TYPES.filter((type) => !['email_account', 'server_account'].includes(type)).map((type) => {
      const config = getVaultItemTypeConfig(type);
      return searchVaultType(type, config?.label ?? type, `/app/accounts/${type}`, trimmed);
    }),
  ]);

  return [...groups.flat(), ...fileResults];
}

async function searchFiles(query: string): Promise<VaultSearchResult[]> {
  const result = await listFiles();
  const rows: VaultSearchResult[] = [];

  for (const file of result.items) {
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
        route: file.albumId ? '/app/albums' : '/app/files',
      });
    }
  }

  return rows;
}
