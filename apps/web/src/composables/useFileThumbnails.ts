import { onBeforeUnmount, ref } from 'vue';
import { isImageFile } from '@vaultpass/types';
import { downloadEncryptedFile } from '@/utils/api';
import {
  createObjectUrl,
  decryptDownloadedFile,
  revokeObjectUrl,
} from '@/utils/file-media';
import type { VaultFileItem } from '@/utils/services';

export function useFileThumbnails(getMfaCode: () => string) {
  const thumbUrls = ref<Record<string, string>>({});
  const loadingIds = ref(new Set<string>());

  async function loadThumbnail(file: VaultFileItem) {
    if (!isImageFile(file) || thumbUrls.value[file.id] || loadingIds.value.has(file.id)) {
      return;
    }

    loadingIds.value.add(file.id);
    try {
      const buffer = await downloadEncryptedFile(file.id, getMfaCode() || undefined);
      const blob = await decryptDownloadedFile(buffer, file.encryptedFileKey, file.mimeType);
      thumbUrls.value[file.id] = createObjectUrl(blob);
    } catch {
      // ignore single thumbnail failures
    } finally {
      loadingIds.value.delete(file.id);
    }
  }

  function cleanup() {
    Object.values(thumbUrls.value).forEach((url) => revokeObjectUrl(url));
    thumbUrls.value = {};
    loadingIds.value.clear();
  }

  onBeforeUnmount(cleanup);

  return { thumbUrls, loadingIds, loadThumbnail, cleanup };
}
