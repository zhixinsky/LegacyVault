import { MANAGED_VAULT_TYPES } from '@vaultpass/types';
import { decryptText } from '@/utils/api';
import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import {
  getInheritanceRule,
  listAlbums,
  listFiles,
  listTrustedContacts,
  listVaultItems,
} from '@/utils/services';

async function decryptVaultItemsByType(type: string) {
  const result = await listVaultItems(type, 1);
  const rows = [];
  for (const item of result.items) {
    rows.push({
      id: item.id,
      title: await decryptVaultTitle(item.titleCiphertext),
      data: await decryptVaultPayload<Record<string, string>>(item.encryptedPayload),
      updatedAt: item.updatedAt,
    });
  }
  return rows;
}

export async function buildVaultExportData() {
  const [passwords, notes, albums, files, contacts, inheritanceRule, ...accountGroups] =
    await Promise.all([
      listVaultItems('password', 1),
      listVaultItems('note', 1),
      listAlbums(),
      listFiles(),
      listTrustedContacts(),
      getInheritanceRule(),
      ...MANAGED_VAULT_TYPES.map((type) => decryptVaultItemsByType(type)),
    ]);

  const accounts = Object.fromEntries(
    MANAGED_VAULT_TYPES.map((type, index) => [type, accountGroups[index]]),
  );

  const decryptedPasswords = [];
  for (const item of passwords.items) {
    decryptedPasswords.push({
      id: item.id,
      title: await decryptVaultTitle(item.titleCiphertext),
      data: await decryptVaultPayload<Record<string, string>>(item.encryptedPayload),
      updatedAt: item.updatedAt,
    });
  }

  const decryptedNotes = [];
  for (const item of notes.items) {
    const payload = await decryptVaultPayload<{ content?: string }>(item.encryptedPayload);
    decryptedNotes.push({
      id: item.id,
      title: await decryptVaultTitle(item.titleCiphertext),
      content: payload.content ?? '',
      updatedAt: item.updatedAt,
    });
  }

  const decryptedContacts = [];
  for (const contact of contacts.items) {
    decryptedContacts.push({
      id: contact.id,
      name: await decryptText(contact.nameCiphertext),
      phone: contact.phoneCiphertext ? await decryptText(contact.phoneCiphertext) : '',
      email: contact.emailCiphertext ? await decryptText(contact.emailCiphertext) : '',
      permissionScope: contact.permissionScope,
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    passwords: decryptedPasswords,
    accounts,
    notes: decryptedNotes,
    albums: albums.items.map((album) => ({
      id: album.id,
      encryptedName: album.encryptedName,
      fileCount: album._count?.files ?? 0,
    })),
    files: files.items,
    contacts: decryptedContacts,
    inheritanceRule,
    note: '相册名称仍为密文，文件内容为加密存储，需单独下载解密',
  };
}

export function saveExportJsonToLocal(data: unknown) {
  const fs = uni.getFileSystemManager();
  const filePath = `${uni.env.USER_DATA_PATH}/vaultpass-export-${Date.now()}.json`;
  const content = JSON.stringify(data, null, 2);

  return new Promise<string>((resolve, reject) => {
    fs.writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: (error) => reject(new Error(error.errMsg || '写入文件失败')),
    });
  });
}
