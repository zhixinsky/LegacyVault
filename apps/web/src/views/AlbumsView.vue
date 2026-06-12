<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useFileThumbnails } from '@/composables/useFileThumbnails';
import { VButton } from '@vaultpass/ui';
import { isImageFile, isVideoFile } from '@vaultpass/types';
import { decryptText, downloadEncryptedFile, uploadEncryptedFile } from '@/utils/api';
import { encryptField, prepareEncryptedUpload } from '@/utils/crypto-flow';
import {
  createObjectUrl,
  decryptDownloadedFile,
  revokeObjectUrl,
} from '@/utils/file-media';
import {
  createAlbum,
  deleteFile,
  getProfile,
  listAlbums,
  listFiles,
  updateAlbum,
  type AlbumItem,
  type VaultFileItem,
} from '@/utils/services';

interface AlbumRow {
  id: string;
  name: string;
  fileCount: number;
  coverThumbUrl?: string;
}

const albums = ref<AlbumRow[]>([]);
const albumFiles = ref<VaultFileItem[]>([]);
const selectedAlbumId = ref('');
const newAlbumName = ref('');
const loading = ref(true);
const uploading = ref(false);
const previewingId = ref('');
const mfaEnabled = ref(false);
const mfaCode = ref('');
const error = ref('');

const previewUrl = ref('');
const previewKind = ref<'image' | 'video' | ''>('');
const previewMime = ref('');
const selectMode = ref(false);
const selectedFileIds = ref<Set<string>>(new Set());
const settingCoverId = ref('');
const renamingAlbumId = ref('');
const renameAlbumName = ref('');
const uploadTags = ref('');

const { thumbUrls, loadingIds, loadThumbnail, cleanup: cleanupThumbs } = useFileThumbnails(
  () => mfaCode.value,
);
let thumbObserver: IntersectionObserver | null = null;

onMounted(async () => {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadAlbums();
});

onBeforeUnmount(() => {
  thumbObserver?.disconnect();
  cleanupThumbs();
  albums.value.forEach((album) => {
    if (album.coverThumbUrl) {
      revokeObjectUrl(album.coverThumbUrl);
    }
  });
  closePreview();
});

function setupThumbnailObserver() {
  thumbObserver?.disconnect();
  if (typeof IntersectionObserver === 'undefined') return;

  thumbObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const id = (entry.target as HTMLElement).dataset.fileId;
      const file = albumFiles.value.find((item) => item.id === id);
      if (file && isImageFile(file)) {
        void loadThumbnail(file);
      }
    }
  }, { rootMargin: '120px' });

  void nextTick(() => {
    document.querySelectorAll('[data-file-id]').forEach((element) => {
      thumbObserver?.observe(element);
    });
  });
}

async function loadAlbums() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listAlbums();
    const rows: AlbumRow[] = [];
    for (const album of result.items) {
      const row: AlbumRow = {
        id: album.id,
        name: await decodeAlbumName(album),
        fileCount: album._count?.files ?? 0,
      };
      if (row.fileCount > 0) {
        row.coverThumbUrl = await loadAlbumCoverThumb(album);
      }
      rows.push(row);
    }
    albums.value = rows;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function decodeAlbumName(album: AlbumItem) {
  try {
    return await decryptText(album.encryptedName);
  } catch {
    return '加密相册';
  }
}

async function loadAlbumCoverThumb(album: AlbumItem) {
  try {
    const filesResult = await listFiles(album.id);
    let coverFile: VaultFileItem | undefined;

    if (album.encryptedCoverFileId) {
      const coverId = await decryptText(album.encryptedCoverFileId);
      coverFile = filesResult.items.find((file) => file.id === coverId && isImageFile(file));
    }

    if (!coverFile) {
      coverFile = filesResult.items.find(isImageFile);
    }

    if (!coverFile) {
      return undefined;
    }

    const buffer = await downloadEncryptedFile(coverFile.id, mfaCode.value || undefined);
    const blob = await decryptDownloadedFile(buffer, coverFile.encryptedFileKey, coverFile.mimeType);
    return createObjectUrl(blob);
  } catch {
    return undefined;
  }
}

async function handleCreateAlbum() {
  if (!newAlbumName.value.trim()) return;
  await createAlbum({ encryptedName: await encryptField(newAlbumName.value.trim()) });
  newAlbumName.value = '';
  await loadAlbums();
}

async function selectAlbum(id: string) {
  cleanupThumbs();
  selectedAlbumId.value = id;
  selectedFileIds.value = new Set();
  selectMode.value = false;
  const result = await listFiles(id);
  albumFiles.value = result.items;
  setupThumbnailObserver();
}

async function handleUpload(event: Event, fileType: 'image' | 'video') {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0 || !selectedAlbumId.value) return;

  uploading.value = true;
  error.value = '';
  try {
    for (const file of files) {
      const prepared = await prepareEncryptedUpload(file, fileType, selectedAlbumId.value, {
        displayName: file.name,
        tags: uploadTags.value.trim() || undefined,
      });
      await uploadEncryptedFile(prepared.blob, prepared.formData);
    }
    input.value = '';
    await selectAlbum(selectedAlbumId.value);
    await loadAlbums();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '上传失败';
  } finally {
    uploading.value = false;
  }
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) {
    selectedFileIds.value = new Set();
  }
}

function toggleFileSelection(id: string) {
  const next = new Set(selectedFileIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedFileIds.value = next;
}

async function handleBatchDelete() {
  if (selectedFileIds.value.size === 0) return;
  if (!confirm(`确定删除选中的 ${selectedFileIds.value.size} 个文件？`)) return;

  await Promise.all([...selectedFileIds.value].map((id) => deleteFile(id)));
  selectedFileIds.value = new Set();
  selectMode.value = false;
  if (selectedAlbumId.value) {
    await selectAlbum(selectedAlbumId.value);
    await loadAlbums();
  }
}

function startRename(album: AlbumRow) {
  renamingAlbumId.value = album.id;
  renameAlbumName.value = album.name;
}

async function saveRename() {
  if (!renamingAlbumId.value || !renameAlbumName.value.trim()) return;
  try {
    await updateAlbum(renamingAlbumId.value, {
      encryptedName: await encryptField(renameAlbumName.value.trim()),
    });
    renamingAlbumId.value = '';
    await loadAlbums();
    if (selectedAlbumId.value) {
      await selectAlbum(selectedAlbumId.value);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '重命名失败';
  }
}

async function handleSetCover(file: VaultFileItem) {
  if (!selectedAlbumId.value || !isImageFile(file)) return;

  settingCoverId.value = file.id;
  error.value = '';
  try {
    await updateAlbum(selectedAlbumId.value, {
      encryptedCoverFileId: await encryptField(file.id),
    });
    await loadAlbums();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '设置封面失败';
  } finally {
    settingCoverId.value = '';
  }
}

function closePreview() {
  if (previewUrl.value) {
    revokeObjectUrl(previewUrl.value);
  }
  previewUrl.value = '';
  previewKind.value = '';
  previewMime.value = '';
}

async function handlePreview(file: VaultFileItem) {
  if (!isImageFile(file) && !isVideoFile(file)) return;
  if (mfaEnabled.value && !mfaCode.value) {
    error.value = '预览前请输入二次验证码';
    return;
  }

  previewingId.value = file.id;
  error.value = '';
  closePreview();

  try {
    const buffer = await downloadEncryptedFile(file.id, mfaCode.value || undefined);
    const blob = await decryptDownloadedFile(buffer, file.encryptedFileKey, file.mimeType);
    previewUrl.value = createObjectUrl(blob);
    previewMime.value = file.mimeType;
    previewKind.value = isVideoFile(file) ? 'video' : 'image';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '预览失败';
  } finally {
    previewingId.value = '';
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该文件？')) return;
  await deleteFile(id);
  if (selectedAlbumId.value) {
    await selectAlbum(selectedAlbumId.value);
    await loadAlbums();
  }
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fileLabel(file: VaultFileItem) {
  if (isImageFile(file)) return '图片';
  if (isVideoFile(file)) return '视频';
  return file.fileType;
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">相册列表</h2>
      <div class="mt-4 flex gap-2">
        <input
          v-model="newAlbumName"
          class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="新相册名称"
        />
        <VButton variant="primary" @click="handleCreateAlbum">创建</VButton>
      </div>

      <div v-if="loading" class="mt-6 text-center text-slate-400">加载中...</div>
      <ul v-else class="mt-4 divide-y divide-slate-100">
        <li
          v-for="album in albums"
          :key="album.id"
          class="flex cursor-pointer items-center gap-3 py-3"
          :class="{ 'bg-blue-50 -mx-2 px-2 rounded-lg': selectedAlbumId === album.id }"
          @click="selectAlbum(album.id)"
        >
          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
            <img
              v-if="album.coverThumbUrl"
              :src="album.coverThumbUrl"
              class="h-full w-full object-cover"
              alt="相册封面"
            />
            <div v-else class="flex h-full items-center justify-center text-xs text-slate-400">相册</div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-900">{{ album.name }}</p>
            <p class="text-xs text-slate-400">{{ album.fileCount }} 个文件</p>
          </div>
          <button
            class="shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            @click.stop="startRename(album)"
          >
            重命名
          </button>
        </li>
      </ul>
    </section>

    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold text-slate-900">相册内容</h2>
        <div v-if="selectedAlbumId" class="flex flex-wrap gap-2">
          <label class="inline-flex cursor-pointer items-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-100">
            {{ uploading ? '上传中...' : '上传图片' }}
            <input
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handleUpload($event, 'image')"
            />
          </label>
          <label class="inline-flex cursor-pointer items-center rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-100">
            {{ uploading ? '上传中...' : '上传视频' }}
            <input type="file" accept="video/*" class="hidden" @change="handleUpload($event, 'video')" />
          </label>
          <button
            class="rounded-xl px-3 py-2 text-sm font-semibold shadow-sm"
            :class="selectMode ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200'"
            @click="toggleSelectMode"
          >
            {{ selectMode ? '取消多选' : '批量选择' }}
          </button>
          <button
            v-if="selectMode && selectedFileIds.size > 0"
            class="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:bg-red-700"
            @click="handleBatchDelete"
          >
            删除 {{ selectedFileIds.size }} 项
          </button>
        </div>
      </div>

      <div v-if="selectedAlbumId" class="mt-4">
        <input
          v-model="uploadTags"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="上传时添加标签（逗号分隔，可选）"
        />
        <p class="mt-2 text-xs text-slate-500">
          视频会先在本机加密再上传，单个原始文件请控制在 180MB 以内。
        </p>
      </div>

      <div v-if="mfaEnabled && selectedAlbumId" class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        预览/下载前请输入二次验证码
        <input
          v-model="mfaCode"
          class="mt-2 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm"
          placeholder="6 位验证码"
        />
      </div>

      <p v-if="!selectedAlbumId" class="mt-8 text-center text-slate-400">请选择相册</p>
      <p v-else-if="albumFiles.length === 0" class="mt-8 text-center text-slate-400">暂无图片或视频</p>
      <div v-else class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="file in albumFiles"
          :key="file.id"
          :data-file-id="file.id"
          class="overflow-hidden rounded-lg border border-slate-200"
          :class="{ 'ring-2 ring-blue-500': selectMode && selectedFileIds.has(file.id) }"
        >
          <label v-if="selectMode" class="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm">
            <input
              type="checkbox"
              :checked="selectedFileIds.has(file.id)"
              @change="toggleFileSelection(file.id)"
            />
            选择
          </label>
          <div
            v-if="isImageFile(file)"
            class="aspect-square cursor-pointer bg-slate-100"
            @click="handlePreview(file)"
          >
            <img
              v-if="thumbUrls[file.id]"
              :src="thumbUrls[file.id]"
              class="h-full w-full object-cover"
              alt="加密缩略图"
            />
            <div
              v-else
              class="flex h-full items-center justify-center text-xs text-slate-400"
            >
              {{ loadingIds.has(file.id) ? '解密中...' : '加载缩略图' }}
            </div>
          </div>
          <div class="p-3">
          <p class="text-sm font-medium text-slate-800">
            {{ fileLabel(file) }} · {{ formatSize(file.fileSize) }}
          </p>
          <p class="mt-1 text-xs text-slate-500">{{ new Date(file.createdAt).toLocaleString() }}</p>
          <div class="mt-3 flex gap-3 text-sm">
            <button
              v-if="isImageFile(file) || isVideoFile(file)"
              class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              :disabled="previewingId === file.id"
              @click="handlePreview(file)"
            >
              {{ previewingId === file.id ? '解密中...' : '加密预览' }}
            </button>
            <button
              v-if="isImageFile(file)"
              class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              :disabled="settingCoverId === file.id"
              @click="handleSetCover(file)"
            >
              {{ settingCoverId === file.id ? '设置中...' : '设为封面' }}
            </button>
            <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleDelete(file.id)">删除</button>
          </div>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="renamingAlbumId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      @click.self="renamingAlbumId = ''"
    >
      <div class="w-full max-w-sm rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h3 class="font-semibold text-slate-900">重命名相册</h3>
        <input
          v-model="renameAlbumName"
          class="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="相册名称"
        />
        <div class="mt-4 flex gap-2">
          <VButton variant="primary" @click="saveRename">保存</VButton>
          <VButton variant="secondary" @click="renamingAlbumId = ''">取消</VButton>
        </div>
      </div>
    </div>

    <p v-if="error" class="lg:col-span-2 text-sm text-red-600">{{ error }}</p>

    <div
      v-if="previewUrl"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      @click="closePreview"
    >
      <div class="max-h-[90vh] max-w-5xl overflow-auto rounded-xl bg-white p-4" @click.stop>
        <img v-if="previewKind === 'image'" :src="previewUrl" class="max-h-[80vh] max-w-full" alt="加密图片预览" />
        <video
          v-else-if="previewKind === 'video'"
          :src="previewUrl"
          class="max-h-[80vh] max-w-full"
          controls
          autoplay
          :type="previewMime"
        />
        <div class="mt-4 text-right">
          <VButton variant="secondary" @click="closePreview">关闭</VButton>
        </div>
      </div>
    </div>
  </div>
</template>
