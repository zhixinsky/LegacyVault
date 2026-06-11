<script setup lang="ts">

import { onMounted, ref } from 'vue';

import { VButton } from '@vaultpass/ui';

import { isImageFile, isVideoFile, parseFileTags } from '@vaultpass/types';

import { downloadEncryptedFile, uploadEncryptedFile } from '@/utils/api';

import {
  decryptFileMetadata,
  encryptFileMetadata,
  prepareEncryptedUpload,
} from '@/utils/crypto-flow';

import {
  createObjectUrl,
  decryptDownloadedFile,
  revokeObjectUrl,
} from '@/utils/file-media';

import {
  deleteFile,
  getProfile,
  listFiles,
  updateFile,
  type VaultFileItem,
} from '@/utils/services';

interface FileRow extends VaultFileItem {
  displayName: string;
  tags: string;
  note: string;
}

const files = ref<FileRow[]>([]);
const uploadTags = ref('');
const uploadDisplayName = ref('');
const editingFileId = ref('');
const editTags = ref('');
const editDisplayName = ref('');
const editNote = ref('');
const savingMetaId = ref('');

const loading = ref(true);

const uploading = ref(false);

const downloadingId = ref('');

const mfaEnabled = ref(false);

const mfaCode = ref('');

const showMfaPrompt = ref(false);

const pendingDownload = ref<VaultFileItem | null>(null);

const error = ref('');

const previewUrl = ref('');

const previewKind = ref<'image' | 'video' | ''>('');

const previewMime = ref('');

const previewingId = ref('');



onMounted(async () => {

  try {

    const profile = await getProfile();

    mfaEnabled.value = profile.mfaEnabled;

  } catch {

    // ignore

  }

  await loadFiles();

});



async function loadFiles() {

  loading.value = true;

  error.value = '';

  try {

    const result = await listFiles();
    const rows: FileRow[] = [];

    for (const item of result.items) {
      const meta = await decryptFileMetadata(item.encryptedMetadata);
      rows.push({
        ...item,
        displayName: meta.displayName ?? '',
        tags: meta.tags ?? '',
        note: meta.note ?? '',
      });
    }

    files.value = rows;

  } catch (err) {

    error.value = err instanceof Error ? err.message : '加载失败';

  } finally {

    loading.value = false;

  }

}



async function handleUpload(event: Event) {

  const input = event.target as HTMLInputElement;

  const file = input.files?.[0];

  if (!file) return;



  uploading.value = true;

  error.value = '';

  try {

    const prepared = await prepareEncryptedUpload(file, 'document', undefined, {
      displayName: uploadDisplayName.value.trim() || file.name,
      tags: uploadTags.value.trim() || undefined,
    });

    await uploadEncryptedFile(prepared.blob, prepared.formData);

    input.value = '';
    uploadTags.value = '';
    uploadDisplayName.value = '';

    await loadFiles();

  } catch (err) {

    error.value = err instanceof Error ? err.message : '上传失败';

  } finally {

    uploading.value = false;

  }

}



function handleDownloadClick(file: VaultFileItem) {

  if (mfaEnabled.value && !mfaCode.value) {

    pendingDownload.value = file;

    showMfaPrompt.value = true;

    return;

  }

  void performDownload(file);

}



async function confirmMfaDownload() {

  if (!pendingDownload.value) return;

  if (!mfaCode.value) {

    error.value = '请输入二次验证码';

    return;

  }

  showMfaPrompt.value = false;

  await performDownload(pendingDownload.value);

  pendingDownload.value = null;

}



async function performDownload(file: VaultFileItem) {

  downloadingId.value = file.id;

  error.value = '';

  try {

    const buffer = await downloadEncryptedFile(file.id, mfaCode.value || undefined);

    const blob = await decryptDownloadedFile(buffer, file.encryptedFileKey, file.mimeType);

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = `vaultpass-${file.id}`;

    link.click();

    URL.revokeObjectURL(url);

  } catch (err) {

    error.value = err instanceof Error ? err.message : '下载失败';

  } finally {

    downloadingId.value = '';

  }

}



async function handleDelete(id: string) {

  if (!confirm('确定删除该文件？')) return;

  await deleteFile(id);

  await loadFiles();

}

function startEditMeta(file: FileRow) {
  editingFileId.value = file.id;
  editDisplayName.value = file.displayName;
  editTags.value = file.tags;
  editNote.value = file.note;
}

async function saveFileMeta() {
  if (!editingFileId.value) return;

  savingMetaId.value = editingFileId.value;
  error.value = '';
  try {
    await updateFile(editingFileId.value, {
      encryptedMetadata: await encryptFileMetadata({
        displayName: editDisplayName.value.trim() || undefined,
        tags: editTags.value.trim() || undefined,
        note: editNote.value.trim() || undefined,
      }),
    });
    editingFileId.value = '';
    await loadFiles();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    savingMetaId.value = '';
  }
}



function formatSize(size: number) {

  if (size < 1024) return `${size} B`;

  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / 1024 / 1024).toFixed(1)} MB`;

}



function closePreview() {

  if (previewUrl.value) revokeObjectUrl(previewUrl.value);

  previewUrl.value = '';

  previewKind.value = '';

}



async function handlePreview(file: VaultFileItem) {

  if (!isImageFile(file) && !isVideoFile(file)) return;

  if (mfaEnabled.value && !mfaCode.value) {

    pendingDownload.value = file;

    showMfaPrompt.value = true;

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

</script>



<template>

  <div class="space-y-6">

    <div class="flex items-center justify-between rounded-xl bg-white p-6 ring-1 ring-slate-200">

      <div>

        <h2 class="font-semibold text-slate-900">加密文件</h2>

        <p class="mt-1 text-sm text-slate-500">文件在本地加密后上传；下载需二次验证（如已启用 MFA）</p>

      </div>

      <label class="inline-flex cursor-pointer items-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 hover:bg-blue-700">

        {{ uploading ? '上传中...' : '选择文件上传' }}

        <input type="file" class="hidden" @change="handleUpload" />

      </label>

    </div>

    <div class="grid gap-3 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
      <input
        v-model="uploadDisplayName"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="显示名称（可选，默认取文件名）"
      />
      <input
        v-model="uploadTags"
        class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder="标签，逗号分隔（可选）"
      />
    </div>



    <div v-if="mfaEnabled" class="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">

      已启用二次验证，下载文件前请输入验证码

      <input

        v-model="mfaCode"

        class="mt-2 w-full max-w-xs rounded-lg border border-amber-300 px-3 py-2 text-sm"

        placeholder="6 位验证码"

      />

    </div>



    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>



    <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">

      <div v-if="loading" class="p-8 text-center text-slate-400">加载中...</div>

      <div v-else-if="files.length === 0" class="p-8 text-center text-slate-400">暂无文件</div>

      <table v-else class="min-w-full text-sm">

        <thead class="bg-slate-50 text-left text-slate-500">

          <tr>

            <th class="px-6 py-3">名称 / 标签</th>

            <th class="px-6 py-3">大小</th>

            <th class="px-6 py-3">上传时间</th>

            <th class="px-6 py-3">操作</th>

          </tr>

        </thead>

        <tbody class="divide-y divide-slate-100">

          <tr v-for="file in files" :key="file.id">

            <td class="px-6 py-4">
              <p class="font-medium text-slate-900">{{ file.displayName || file.fileType }}</p>
              <p v-if="file.tags" class="mt-1 text-xs text-slate-500">
                {{ parseFileTags(file.tags).join(' · ') }}
              </p>
            </td>

            <td class="px-6 py-4">{{ formatSize(file.fileSize) }}</td>

            <td class="px-6 py-4">{{ new Date(file.createdAt).toLocaleString() }}</td>

            <td class="px-6 py-4 space-x-3">

              <button
                v-if="isImageFile(file) || isVideoFile(file)"
                class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                :disabled="previewingId === file.id"
                @click="handlePreview(file)"
              >
                {{ previewingId === file.id ? '解密中...' : '加密预览' }}
              </button>

              <button

                class="rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"

                :disabled="downloadingId === file.id"

                @click="handleDownloadClick(file)"

              >

                {{ downloadingId === file.id ? '解密中...' : '下载解密' }}

              </button>

              <button class="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200" @click="startEditMeta(file)">标签</button>

              <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleDelete(file.id)">删除</button>

            </td>

          </tr>

        </tbody>

      </table>

    </div>



    <div
      v-if="editingFileId"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div class="w-full max-w-md rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h3 class="font-semibold text-slate-900">编辑文件标签</h3>
        <div class="mt-4 space-y-3">
          <input
            v-model="editDisplayName"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="显示名称"
          />
          <input
            v-model="editTags"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="标签，逗号分隔"
          />
          <input
            v-model="editNote"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="备注"
          />
        </div>
        <div class="mt-4 flex gap-2">
          <VButton variant="primary" :disabled="savingMetaId === editingFileId" @click="saveFileMeta">
            保存
          </VButton>
          <VButton variant="secondary" @click="editingFileId = ''">取消</VButton>
        </div>
      </div>
    </div>

    <div

      v-if="showMfaPrompt"

      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"

    >

      <div class="w-full max-w-sm rounded-xl bg-white p-6 ring-1 ring-slate-200">

        <h3 class="font-semibold text-slate-900">下载前二次验证</h3>

        <input

          v-model="mfaCode"

          class="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

          placeholder="输入 6 位验证码"

        />

        <div class="mt-4 flex gap-2">

          <VButton variant="primary" @click="confirmMfaDownload">确认下载</VButton>

          <VButton variant="secondary" @click="showMfaPrompt = false">取消</VButton>

        </div>

      </div>

    </div>



    <div

      v-if="previewUrl"

      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"

      @click="closePreview"

    >

      <div class="max-h-[90vh] max-w-5xl overflow-auto rounded-xl bg-white p-4" @click.stop>

        <img v-if="previewKind === 'image'" :src="previewUrl" class="max-h-[80vh] max-w-full" alt="预览" />

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

