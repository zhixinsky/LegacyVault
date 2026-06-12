<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import type { JSONContent } from '@tiptap/vue-3';
import { downloadEncryptedFile, uploadEncryptedFile } from '@/utils/api';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import { decryptDownloadedFile } from '@/utils/file-media';
import { prepareEncryptedUpload } from '@/utils/crypto-flow';
import { createVaultItem, getProfile, getVaultItem, updateVaultItem, type VaultFileItem } from '@/utils/services';
import {
  EncryptedAttachment,
  EncryptedImage,
  EncryptedVideo,
  type EncryptedAssetAttrs,
} from '@/utils/rich-note-extensions';
import {
  EMPTY_RICH_NOTE_DOC,
  createRichNotePayload,
  isRichNoteEmpty,
  normalizeRichNotePayload,
  richNoteDocToPlainText,
  type RichNoteNode,
  type RichNotePayload,
} from '@/utils/rich-note';

const route = useRoute();
const router = useRouter();
const routeId = computed(() => String(route.params.id ?? ''));
const createdId = ref('');
const itemId = computed(() => createdId.value || routeId.value);
const isEdit = computed(() => Boolean(itemId.value));

const title = ref('');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const saveStatus = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'failed'>('idle');
const lastSavedAt = ref('');
const imageInput = ref<HTMLInputElement | null>(null);
const videoInput = ref<HTMLInputElement | null>(null);
const attachmentInput = ref<HTMLInputElement | null>(null);
const uploadingAsset = ref(false);
const downloadingAssetId = ref('');
const mfaEnabled = ref(false);
const mfaCode = ref('');
const insertMenuOpen = ref(false);
const previewUrls = new Map<string, string>();
let autoSaveTimer: number | undefined;
let suppressUpdate = false;

const editor = useEditor({
  content: EMPTY_RICH_NOTE_DOC as JSONContent,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: 'rich-note-link',
      },
    }),
    Placeholder.configure({
      placeholder: '开始写私密笔记，输入 / 可作为后续插入菜单入口...',
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    EncryptedImage,
    EncryptedVideo,
    EncryptedAttachment,
  ],
  editorProps: {
    attributes: {
      class: 'rich-note-editor',
    },
    handleKeyDown: (_view, event) => {
      if (event.key === '/') {
        insertMenuOpen.value = true;
      }
      return false;
    },
  },
  onUpdate: () => {
    if (suppressUpdate) return;
    markDirty();
  },
});

onMounted(async () => {
  void loadMfaState();
  if (!routeId.value) return;
  loading.value = true;
  try {
    const item = await getVaultItem(routeId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<RichNotePayload>(item.encryptedPayload);
    const normalized = normalizeRichNotePayload(payload);
    setEditorContent(await hydrateEncryptedMedia(normalized.doc));
    lastSavedAt.value = item.updatedAt;
    saveStatus.value = 'saved';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
  for (const url of previewUrls.values()) URL.revokeObjectURL(url);
  editor.value?.destroy();
});

const statusText = computed(() => {
  if (saveStatus.value === 'saving') return '保存中';
  if (saveStatus.value === 'saved') return lastSavedAt.value ? `已保存 ${formatTime(lastSavedAt.value)}` : '已保存';
  if (saveStatus.value === 'failed') return '保存失败';
  if (saveStatus.value === 'dirty') return '有未保存修改';
  return '本地加密编辑';
});

const canSave = computed(() => {
  return Boolean(title.value.trim()) && !isRichNoteEmpty(getEditorDoc(), getPlainText());
});

function markDirty() {
  saveStatus.value = 'dirty';
  error.value = '';
  if (!itemId.value) return;
  if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(() => {
    void handleSave({ silent: true });
  }, 1200);
}

function setEditorContent(doc: RichNoteNode) {
  suppressUpdate = true;
  editor.value?.commands.setContent(doc as JSONContent);
  suppressUpdate = false;
}

function getEditorDoc() {
  return editor.value?.getJSON() as RichNoteNode | undefined;
}

function getPlainText() {
  return editor.value?.getText({ blockSeparator: '\n' }).trim() ?? '';
}

async function handleSave(options: { silent?: boolean } = {}) {
  if (!title.value.trim()) {
    if (!options.silent) error.value = '请填写标题';
    return;
  }

  const doc = getEditorDoc();
  const plainText = getPlainText();
  if (isRichNoteEmpty(doc, plainText)) {
    if (!options.silent) error.value = '请填写笔记内容';
    return;
  }

  saving.value = true;
  saveStatus.value = 'saving';
  try {
    const encrypted = await encryptVaultItemPayload(
      createRichNotePayload(stripRuntimeAssetUrls(doc ?? EMPTY_RICH_NOTE_DOC), plainText),
      title.value.trim(),
    );

    if (itemId.value) {
      await updateVaultItem(itemId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      const created = await createVaultItem({
        type: 'note',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
      createdId.value = created.id;
      await router.replace(`/app/notes/${created.id}/edit`);
    }

    lastSavedAt.value = new Date().toISOString();
    saveStatus.value = 'saved';
    if (!options.silent) {
      router.push('/app/notes');
    }
  } catch (err) {
    saveStatus.value = 'failed';
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    saving.value = false;
  }
}

async function loadMfaState() {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore; file download will still enforce MFA server-side if enabled.
  }
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadingAsset.value = true;
  error.value = '';
  try {
    const prepared = await prepareEncryptedUpload(file, 'note_image', undefined, {
      displayName: file.name,
      tags: '私密笔记',
    });
    const uploaded = await uploadEncryptedFile(prepared.blob, prepared.formData) as VaultFileItem;
    const src = URL.createObjectURL(file);
    previewUrls.set(uploaded.id, src);
    editor.value?.chain().focus().insertContent({
      type: 'encryptedImage',
      attrs: buildAssetAttrs(uploaded, file.name, src),
    }).run();
    markDirty();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '图片上传失败';
  } finally {
    uploadingAsset.value = false;
    input.value = '';
  }
}

async function handleAttachmentUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadingAsset.value = true;
  error.value = '';
  try {
    const prepared = await prepareEncryptedUpload(file, 'note_attachment', undefined, {
      displayName: file.name,
      tags: '私密笔记',
    });
    const uploaded = await uploadEncryptedFile(prepared.blob, prepared.formData) as VaultFileItem;
    editor.value?.chain().focus().insertContent({
      type: 'encryptedAttachment',
      attrs: buildAssetAttrs(uploaded, file.name),
    }).run();
    markDirty();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '附件上传失败';
  } finally {
    uploadingAsset.value = false;
    input.value = '';
  }
}

async function handleVideoUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploadingAsset.value = true;
  error.value = '';
  try {
    const prepared = await prepareEncryptedUpload(file, 'note_video', undefined, {
      displayName: file.name,
      tags: '私密笔记',
    });
    const uploaded = await uploadEncryptedFile(prepared.blob, prepared.formData) as VaultFileItem;
    const src = URL.createObjectURL(file);
    previewUrls.set(uploaded.id, src);
    editor.value?.chain().focus().insertContent({
      type: 'encryptedVideo',
      attrs: buildAssetAttrs(uploaded, file.name, src),
    }).run();
    markDirty();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '视频上传失败';
  } finally {
    uploadingAsset.value = false;
    input.value = '';
  }
}

async function handleEditorClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>('[data-download-file-id]');
  if (!button) return;
  const fileId = button.dataset.downloadFileId ?? '';
  const node = button.closest<HTMLElement>('[data-type="encrypted-attachment"]');
  if (!fileId || !node) return;
  await downloadAsset({
    fileId,
    encryptedFileKey: node.dataset.encryptedFileKey ?? '',
    mimeType: node.dataset.mimeType ?? 'application/octet-stream',
    name: node.dataset.name ?? 'vaultpass-attachment',
    size: Number(node.dataset.size ?? 0),
  });
}

async function downloadAsset(asset: EncryptedAssetAttrs) {
  downloadingAssetId.value = asset.fileId;
  error.value = '';
  try {
    const buffer = await downloadEncryptedFile(asset.fileId, mfaCode.value || undefined);
    const blob = await decryptDownloadedFile(buffer, asset.encryptedFileKey, asset.mimeType);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = asset.name || `vaultpass-${asset.fileId}`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '附件下载失败';
  } finally {
    downloadingAssetId.value = '';
  }
}

function buildAssetAttrs(file: VaultFileItem, name: string, src = ''): EncryptedAssetAttrs {
  return {
    fileId: file.id,
    encryptedFileKey: file.encryptedFileKey,
    mimeType: file.mimeType,
    name,
    size: file.fileSize,
    src,
  };
}

async function hydrateEncryptedMedia(doc: RichNoteNode) {
  const cloned = structuredClone(doc);
  const mediaNodes: RichNoteNode[] = [];
  walkDoc(cloned, (node) => {
    if (
      (node.type === 'encryptedImage' || node.type === 'encryptedVideo') &&
      node.attrs?.fileId &&
      node.attrs?.encryptedFileKey
    ) {
      mediaNodes.push(node);
    }
  });

  await Promise.all(mediaNodes.map(async (node) => {
    const attrs = node.attrs as unknown as EncryptedAssetAttrs;
    try {
      const buffer = await downloadEncryptedFile(attrs.fileId, mfaCode.value || undefined);
      const blob = await decryptDownloadedFile(buffer, attrs.encryptedFileKey, attrs.mimeType);
      const url = URL.createObjectURL(blob);
      previewUrls.set(attrs.fileId, url);
      node.attrs = { ...node.attrs, src: url };
    } catch {
      node.attrs = { ...node.attrs, src: '' };
    }
  }));

  return cloned;
}

function stripRuntimeAssetUrls(doc: RichNoteNode) {
  const cloned = structuredClone(doc);
  walkDoc(cloned, (node) => {
    if (
      (node.type === 'encryptedImage' ||
        node.type === 'encryptedVideo' ||
        node.type === 'encryptedAttachment') &&
      node.attrs
    ) {
      node.attrs = { ...node.attrs, src: '' };
    }
  });
  return cloned;
}

function walkDoc(node: RichNoteNode, visitor: (node: RichNoteNode) => void) {
  visitor(node);
  for (const child of node.content ?? []) {
    walkDoc(child, visitor);
  }
}

function applyLink() {
  const previousUrl = editor.value?.getAttributes('link').href as string | undefined;
  const url = window.prompt('输入链接地址', previousUrl ?? 'https://');
  if (url === null) return;
  if (!url.trim()) {
    editor.value?.chain().focus().unsetLink().run();
    return;
  }
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
}

function applyCodeLanguage() {
  const language = window.prompt('代码语言，例如 javascript / python / sql', 'javascript');
  if (language === null) return;
  editor.value?.chain().focus().setCodeBlock({ language: language.trim() }).run();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function previewPlainText() {
  return richNoteDocToPlainText(getEditorDoc());
}

async function reloadAssetPreviews() {
  const doc = getEditorDoc();
  if (!doc) return;
  setEditorContent(await hydrateEncryptedMedia(stripRuntimeAssetUrls(doc)));
}

function insertBlock(kind: 'paragraph' | 'heading' | 'table' | 'image' | 'video' | 'attachment' | 'code' | 'quote' | 'todo') {
  insertMenuOpen.value = false;
  if (kind === 'paragraph') editor.value?.chain().focus().setParagraph().run();
  if (kind === 'heading') editor.value?.chain().focus().toggleHeading({ level: 2 }).run();
  if (kind === 'table') editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (kind === 'image') imageInput.value?.click();
  if (kind === 'video') videoInput.value?.click();
  if (kind === 'attachment') attachmentInput.value?.click();
  if (kind === 'code') applyCodeLanguage();
  if (kind === 'quote') editor.value?.chain().focus().toggleBlockquote().run();
  if (kind === 'todo') editor.value?.chain().focus().toggleTaskList().run();
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="rounded-3xl bg-white/95 p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-blue-600">私密笔记</p>
          <h2 class="mt-1 text-2xl font-bold text-slate-950">{{ isEdit ? '编辑私密笔记' : '新增私密笔记' }}</h2>
        </div>
        <div class="flex items-center gap-3">
          <span
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="saveStatus === 'failed' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'"
          >
            {{ statusText }}
          </span>
          <VButton variant="secondary" @click="router.push('/app/notes')">返回列表</VButton>
          <VButton variant="primary" :disabled="saving || !canSave" @click="handleSave()">
            {{ saving ? '加密保存中...' : '加密保存' }}
          </VButton>
        </div>
      </div>

      <div v-if="loading && routeId" class="mt-8 rounded-2xl bg-slate-50 p-10 text-center text-slate-400">
        加载中...
      </div>

      <div v-else class="mt-6 space-y-4">
        <input
          v-model="title"
          class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xl font-bold text-slate-950 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          placeholder="笔记标题"
          @input="markDirty"
        />

        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div class="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/90 p-3">
            <div class="relative">
              <button class="toolbar-btn" @click="insertMenuOpen = !insertMenuOpen">插入</button>
              <div
                v-if="insertMenuOpen"
                class="absolute left-0 top-11 z-20 grid w-44 gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
              >
                <button class="insert-menu-btn" @click="insertBlock('heading')">标题</button>
                <button class="insert-menu-btn" @click="insertBlock('table')">表格</button>
                <button class="insert-menu-btn" @click="insertBlock('image')">图片</button>
                <button class="insert-menu-btn" @click="insertBlock('video')">视频</button>
                <button class="insert-menu-btn" @click="insertBlock('attachment')">附件</button>
                <button class="insert-menu-btn" @click="insertBlock('code')">代码块</button>
                <button class="insert-menu-btn" @click="insertBlock('quote')">引用</button>
                <button class="insert-menu-btn" @click="insertBlock('todo')">待办</button>
              </div>
            </div>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('heading', { level: 1 }) }" @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()">H1</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()">B</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()">I</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('strike') }" @click="editor?.chain().focus().toggleStrike().run()">S</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()">无序</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()">有序</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('taskList') }" @click="editor?.chain().focus().toggleTaskList().run()">待办</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('blockquote') }" @click="editor?.chain().focus().toggleBlockquote().run()">引用</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('codeBlock') }" @click="applyCodeLanguage">代码</button>
            <button class="toolbar-btn" @click="editor?.chain().focus().setHorizontalRule().run()">分割线</button>
            <button class="toolbar-btn" :class="{ active: editor?.isActive('link') }" @click="applyLink">链接</button>
            <button class="toolbar-btn" @click="editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">表格</button>
            <button v-if="editor?.isActive('table')" class="toolbar-btn" @click="editor?.chain().focus().addColumnAfter().run()">加列</button>
            <button v-if="editor?.isActive('table')" class="toolbar-btn" @click="editor?.chain().focus().addRowAfter().run()">加行</button>
            <button v-if="editor?.isActive('table')" class="toolbar-btn" @click="editor?.chain().focus().deleteColumn().run()">删列</button>
            <button v-if="editor?.isActive('table')" class="toolbar-btn" @click="editor?.chain().focus().deleteRow().run()">删行</button>
            <button v-if="editor?.isActive('table')" class="toolbar-btn" @click="editor?.chain().focus().deleteTable().run()">删表</button>
            <button class="toolbar-btn" :disabled="uploadingAsset" @click="imageInput?.click()">
              {{ uploadingAsset ? '上传中' : '图片' }}
            </button>
            <button class="toolbar-btn" :disabled="uploadingAsset" @click="videoInput?.click()">
              {{ uploadingAsset ? '上传中' : '视频' }}
            </button>
            <button class="toolbar-btn" :disabled="uploadingAsset" @click="attachmentInput?.click()">
              {{ uploadingAsset ? '上传中' : '附件' }}
            </button>
            <button class="toolbar-btn" @click="editor?.chain().focus().undo().run()">撤销</button>
            <button class="toolbar-btn" @click="editor?.chain().focus().redo().run()">重做</button>
          </div>
          <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
          <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="handleVideoUpload" />
          <input ref="attachmentInput" type="file" class="hidden" @change="handleAttachmentUpload" />
          <div @click="handleEditorClick">
            <EditorContent :editor="editor" />
          </div>
        </div>

        <div v-if="mfaEnabled" class="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800 ring-1 ring-amber-100">
          已启用二次验证。图片预览和附件下载需要输入 6 位验证码：
          <input
            v-model="mfaCode"
            class="ml-2 inline-block w-36 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
            placeholder="验证码"
          />
          <button class="ml-2 rounded-xl bg-amber-200 px-3 py-2 text-sm font-bold text-amber-900" @click="reloadAssetPreviews">
            刷新图片预览
          </button>
        </div>

        <div class="rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
          内容、图片和附件都会在本机加密后保存，服务器只接收密文。当前纯文本摘要：{{ previewPlainText() || '暂无内容' }}
        </div>

        <p v-if="error" class="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar-btn {
  min-height: 36px;
  border-radius: 12px;
  background: #ffffff;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: #475569;
  box-shadow: inset 0 0 0 1px #e2e8f0;
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.toolbar-btn:hover,
.toolbar-btn.active {
  background: #2563eb;
  color: #ffffff;
  box-shadow: inset 0 0 0 1px #2563eb;
}

.toolbar-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.insert-menu-btn {
  border-radius: 12px;
  padding: 9px 10px;
  text-align: left;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
}

.insert-menu-btn:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

:deep(.rich-note-editor) {
  min-height: 520px;
  padding: 28px;
  color: #0f172a;
  outline: none;
}

:deep(.rich-note-editor > * + *) {
  margin-top: 0.75em;
}

:deep(.rich-note-editor h1) {
  font-size: 2rem;
  line-height: 1.2;
  font-weight: 800;
}

:deep(.rich-note-editor h2) {
  font-size: 1.5rem;
  line-height: 1.3;
  font-weight: 800;
}

:deep(.rich-note-editor h3) {
  font-size: 1.2rem;
  font-weight: 800;
}

:deep(.rich-note-editor ul),
:deep(.rich-note-editor ol) {
  padding-left: 1.35rem;
}

:deep(.rich-note-editor ul) {
  list-style: disc;
}

:deep(.rich-note-editor ol) {
  list-style: decimal;
}

:deep(.rich-note-editor blockquote) {
  border-left: 4px solid #bfdbfe;
  background: #eff6ff;
  border-radius: 12px;
  padding: 12px 16px;
  color: #334155;
}

:deep(.rich-note-editor pre) {
  overflow-x: auto;
  border-radius: 16px;
  background: #0f172a;
  padding: 16px;
  color: #dbeafe;
  font-size: 13px;
  position: relative;
}

:deep(.rich-note-editor pre[data-language]::before) {
  content: attr(data-language);
  display: block;
  margin-bottom: 10px;
  color: #93c5fd;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

:deep(.rich-note-editor code) {
  border-radius: 6px;
  background: #e2e8f0;
  padding: 2px 5px;
  font-size: 0.9em;
}

:deep(.rich-note-editor pre code) {
  background: transparent;
  padding: 0;
}

:deep(.rich-note-editor hr) {
  border: 0;
  border-top: 1px solid #e2e8f0;
  margin: 24px 0;
}

:deep(.rich-note-editor table) {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

:deep(.rich-note-editor th),
:deep(.rich-note-editor td) {
  min-width: 96px;
  border: 1px solid #cbd5e1;
  padding: 10px 12px;
  vertical-align: top;
}

:deep(.rich-note-editor th) {
  background: #eff6ff;
  font-weight: 800;
}

:deep(.rich-note-editor .selectedCell::after) {
  background: rgba(37, 99, 235, 0.12);
  content: '';
  inset: 0;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

:deep(.rich-note-editor a) {
  color: #2563eb;
  text-decoration: underline;
}

:deep(.rich-note-editor ul[data-type='taskList']) {
  list-style: none;
  padding-left: 0;
}

:deep(.rich-note-editor ul[data-type='taskList'] li) {
  display: flex;
  gap: 10px;
}

:deep(.rich-note-editor ul[data-type='taskList'] label) {
  padding-top: 2px;
}

:deep(.rich-note-editor .is-empty::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: #94a3b8;
  pointer-events: none;
}

:deep(.encrypted-image-node) {
  margin: 18px 0;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 18px;
  background: #f8fbff;
}

:deep(.encrypted-image-node img) {
  display: block;
  width: 100%;
  max-height: 520px;
  object-fit: contain;
  background: #eff6ff;
}

:deep(.encrypted-image-node figcaption) {
  padding: 10px 14px;
  color: #64748b;
  font-size: 13px;
}

:deep(.encrypted-image-placeholder) {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: #2563eb;
  font-weight: 700;
}

:deep(.encrypted-video-node) {
  margin: 18px 0;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 18px;
  background: #f8fbff;
}

:deep(.encrypted-video-node video) {
  display: block;
  width: 100%;
  max-height: 520px;
  background: #0f172a;
}

:deep(.encrypted-video-node figcaption) {
  padding: 10px 14px;
  color: #64748b;
  font-size: 13px;
}

:deep(.encrypted-video-placeholder) {
  display: grid;
  min-height: 220px;
  place-items: center;
  background: #0f172a;
  color: #bfdbfe;
  font-weight: 800;
}

:deep(.encrypted-attachment-node) {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 16px 0;
  border: 1px solid #dbeafe;
  border-radius: 18px;
  background: #f8fbff;
  padding: 14px;
}

:deep(.attachment-icon) {
  display: grid;
  height: 44px;
  width: 44px;
  place-items: center;
  border-radius: 14px;
  background: #2563eb;
  color: #fff;
  font-size: 11px;
  font-weight: 900;
}

:deep(.attachment-body) {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 3px;
}

:deep(.attachment-body strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.attachment-body span) {
  color: #64748b;
  font-size: 12px;
}

:deep(.attachment-download) {
  border-radius: 12px;
  background: #dbeafe;
  padding: 8px 12px;
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 800;
}
</style>
