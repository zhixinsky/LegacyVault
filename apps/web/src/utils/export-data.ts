import { MANAGED_VAULT_TYPES } from '@vaultpass/types';
import { decryptText } from '@/utils/api';
import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';
import { normalizeRichNotePayload, type RichNotePayload } from '@/utils/rich-note';
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
  const [emailAccounts, serverAccounts, notes, albums, files, contacts, inheritanceRule, ...accountGroups] =
    await Promise.all([
      listVaultItems('email_account', 1),
      listVaultItems('server_account', 1),
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
  for (const item of [...emailAccounts.items, ...serverAccounts.items]) {
    decryptedPasswords.push({
      id: item.id,
      title: await decryptVaultTitle(item.titleCiphertext),
      data: await decryptVaultPayload<Record<string, string>>(item.encryptedPayload),
      updatedAt: item.updatedAt,
    });
  }

  const decryptedNotes = [];
  for (const item of notes.items) {
    const payload = await decryptVaultPayload<RichNotePayload>(item.encryptedPayload);
    const note = normalizeRichNotePayload(payload);
    decryptedNotes.push({
      id: item.id,
      title: await decryptVaultTitle(item.titleCiphertext),
      content: note.content,
      doc: payload.doc,
      updatedAt: item.updatedAt,
    });
  }

  const decryptedContacts = [];
  for (const contact of contacts.items) {
    decryptedContacts.push({
      id: contact.id,
      name: await decryptText(contact.nameCiphertext),
      phone: await decryptText(contact.phoneCiphertext),
      email: await decryptText(contact.emailCiphertext),
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

export function downloadExportJson(data: unknown, filenamePrefix = 'vaultpass-export') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
