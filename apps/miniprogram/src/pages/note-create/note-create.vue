<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onLoad, onReady } from '@dcloudio/uni-app';
import { computed, nextTick, ref } from 'vue';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import {
  editorDeltaToRichNotePayload,
  getRichNoteFeatureSummary,
  isMiniEditableRichNote,
  normalizeRichNotePayload,
  plainTextToRichNotePayload,
  richNoteToEditorHtml,
  richNoteToPlainText,
  type RichNotePayload,
} from '@/utils/rich-note';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

type NoteMode = 'read' | 'edit';

interface EditorContext {
  setContents(options: { html?: string; delta?: unknown; success?: () => void; fail?: (error: unknown) => void }): void;
  getContents(options: { success: (result: { html: string; text: string; delta?: unknown }) => void; fail?: (error: unknown) => void }): void;
  format(name: string, value?: string | boolean | number): void;
  insertDivider(): void;
  clear(): void;
  undo(): void;
  redo(): void;
}

const editId = ref('');
const title = ref('');
const mode = ref<NoteMode>('edit');
const saving = ref(false);
const loading = ref(false);
const editorReady = ref(false);
const editorHtml = ref('<p></p>');
const readHtml = ref('<p></p>');
const plainPreview = ref('');
const readonlyPreview = ref(false);
const richFeatures = ref<string[]>([]);
const hasPendingContent = ref(false);
const lastSavedText = ref('');
let editorContext: EditorContext | null = null;

const pageTitle = computed(() => {
  if (!editId.value) return '新增私密笔记';
  return mode.value === 'read' ? '私密笔记' : '编辑笔记';
});
const canEdit = computed(() => !readonlyPreview.value);

onLoad((query) => {
  editId.value = String(query?.id ?? '');
  mode.value = editId.value ? 'read' : 'edit';
  if (editId.value) void loadItem();
});

onReady(() => {
  initEditor();
});

function initEditor() {
  uni
    .createSelectorQuery()
    .select('#noteEditor')
    .context((res) => {
      editorContext = (res as { context?: EditorContext }).context ?? null;
      editorReady.value = Boolean(editorContext);
      if (hasPendingContent.value) {
        setEditorHtml(editorHtml.value);
      }
    })
    .exec();
}

async function loadItem() {
  loading.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = normalizeRichNotePayload(await decryptVaultPayload<RichNotePayload>(item.encryptedPayload));
    const html = richNoteToEditorHtml(payload);
    const plainText = richNoteToPlainText(payload);
    editorHtml.value = html;
    readHtml.value = html;
    plainPreview.value = plainText;
    richFeatures.value = getRichNoteFeatureSummary(payload);
    readonlyPreview.value = !isMiniEditableRichNote(payload);
    lastSavedText.value = '已加载';
    await nextTick();
    setEditorHtml(html);
  } catch (error) {
    uni.showToast({ title: friendlyErrorMessage(error, '加载失败'), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function setEditorHtml(html: string) {
  hasPendingContent.value = true;
  if (!editorContext) return;
  editorContext.setContents({
    html,
    success: () => {
      hasPendingContent.value = false;
    },
  });
}

function startEdit() {
  if (!canEdit.value) {
    uni.showToast({ title: '此笔记包含复杂内容，请在 PC 端编辑', icon: 'none' });
    return;
  }
  mode.value = 'edit';
  void nextTick(() => setEditorHtml(editorHtml.value || readHtml.value));
}

function backToRead() {
  if (!editId.value) {
    uni.navigateBack();
    return;
  }
  mode.value = 'read';
}

function handleBack() {
  if (mode.value === 'edit') {
    backToRead();
    return;
  }
  uni.navigateBack();
}

function applyFormat(name: string, value?: string | boolean | number) {
  if (!editorContext || readonlyPreview.value) return;
  editorContext.format(name, value);
}

function insertDivider() {
  if (!editorContext || readonlyPreview.value) return;
  editorContext.insertDivider();
}

function clearEditor() {
  if (!editorContext || readonlyPreview.value) return;
  uni.showModal({
    title: '清空内容',
    content: '确定清空当前笔记内容？',
    success: (res) => {
      if (res.confirm) editorContext?.clear();
    },
  });
}

function getEditorContents() {
  return new Promise<{ html: string; text: string; delta?: unknown }>((resolve, reject) => {
    if (!editorContext) {
      reject(new Error('编辑器未准备好'));
      return;
    }
    editorContext.getContents({
      success: resolve,
      fail: reject,
    });
  });
}

async function handleSave() {
  if (readonlyPreview.value) {
    uni.showToast({ title: '复杂富文本请在电脑端编辑', icon: 'none' });
    return;
  }

  if (!title.value.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    const contents = editorContext
      ? await getEditorContents()
      : { html: editorHtml.value, text: plainPreview.value, delta: undefined };
    const text = contents.text.trim();
    if (!text) {
      uni.showToast({ title: '请填写笔记内容', icon: 'none' });
      return;
    }

    const payload = contents.delta
      ? editorDeltaToRichNotePayload(contents.delta as never, text)
      : plainTextToRichNotePayload(text);
    const encrypted = await encryptVaultItemPayload(payload, title.value.trim());
    if (editId.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      const created = await createVaultItem({
        type: 'note',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
      editId.value = created.id;
    }

    editorHtml.value = contents.html;
    readHtml.value = contents.html || richNoteToEditorHtml(payload);
    plainPreview.value = text;
    lastSavedText.value = '刚刚保存';
    mode.value = 'read';
    uni.showToast({ title: '已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: friendlyErrorMessage(error, '保存失败'),
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <view class="note-page">
    <view class="note-nav">
      <button class="nav-btn" @tap="handleBack">返回</button>
      <text class="nav-title">{{ pageTitle }}</text>
      <button v-if="mode === 'read'" class="nav-btn primary" :disabled="!canEdit" @tap="startEdit">编辑</button>
      <button v-else class="nav-btn primary" :loading="saving" @tap="handleSave">保存</button>
    </view>

    <view v-if="loading" class="loading-state">加载中...</view>

    <view v-else-if="mode === 'read'" class="reader">
      <view class="reader-card">
        <text class="reader-title">{{ title || '未命名笔记' }}</text>
        <text v-if="lastSavedText" class="reader-meta">{{ lastSavedText }}</text>
        <view v-if="readonlyPreview" class="preview-alert">
          <text class="preview-title">此笔记包含 PC 端复杂富文本</text>
          <text class="preview-desc">
            已安全预览 {{ richFeatures.join('、') || '复杂内容' }}，请在 PC 端编辑完整内容。
          </text>
        </view>
        <rich-text class="rich-reader" :nodes="readHtml" />
        <text v-if="!plainPreview" class="empty-note">暂无内容</text>
      </view>
    </view>

    <view v-else class="editor-shell">
      <input v-model="title" class="title-input" placeholder="标题" />
      <view v-if="readonlyPreview" class="preview-alert">
        <text class="preview-title">此笔记包含电脑端富文本内容</text>
        <text class="preview-desc">
          包含 {{ richFeatures.join('、') }}。请在 PC 端编辑，避免覆盖表格、媒体或附件。
        </text>
      </view>
      <editor
        id="noteEditor"
        class="note-editor"
        placeholder="开始写私密笔记..."
        show-img-size
        show-img-toolbar
        show-img-resize
        @ready="initEditor"
      />
      <view class="toolbar">
        <button @tap="applyFormat('bold')">B</button>
        <button @tap="applyFormat('italic')">I</button>
        <button @tap="applyFormat('underline')">U</button>
        <button @tap="applyFormat('header', 2)">H2</button>
        <button @tap="applyFormat('list', 'bullet')">列表</button>
        <button @tap="applyFormat('blockquote')">引用</button>
        <button @tap="applyFormat('code-block')">代码</button>
        <button @tap="insertDivider">分割线</button>
        <button class="danger" @tap="clearEditor">清空</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.note-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 0%, rgba(30, 77, 255, 0.08), transparent 36%),
    linear-gradient(180deg, #f7faff 0%, #f4f7fb 100%);
  box-sizing: border-box;
}

.note-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  height: 104rpx;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 28rpx;
  background: rgba(247, 250, 255, 0.92);
  backdrop-filter: blur(18rpx);
  box-sizing: border-box;
}

.nav-title {
  color: #0b1f4d;
  font-size: 30rpx;
  font-weight: 650;
}

.nav-btn {
  min-width: 112rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #64748b;
  font-size: 24rpx;
  line-height: 64rpx;
  box-shadow: 0 8rpx 24rpx rgba(28, 55, 100, 0.06);
}

.nav-btn::after {
  border: none;
}

.nav-btn.primary {
  background: #1e4dff;
  color: #fff;
}

.nav-btn[disabled] {
  background: #e2e8f0;
  color: #94a3b8;
}

.loading-state {
  padding: 120rpx 32rpx;
  color: #64748b;
  text-align: center;
}

.reader {
  padding: 28rpx 28rpx 80rpx;
}

.reader-card {
  min-height: calc(100vh - 180rpx);
  padding: 38rpx 34rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20rpx 54rpx rgba(28, 55, 100, 0.08);
  box-sizing: border-box;
}

.reader-title {
  display: block;
  color: #0b1f4d;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.28;
}

.reader-meta {
  display: block;
  margin-top: 12rpx;
  color: #94a3b8;
  font-size: 22rpx;
}

.rich-reader {
  display: block;
  margin-top: 34rpx;
  color: #1f2937;
  font-size: 30rpx;
  line-height: 1.8;
}

.empty-note {
  display: block;
  margin-top: 80rpx;
  color: #94a3b8;
  text-align: center;
}

.editor-shell {
  display: flex;
  min-height: calc(100vh - 104rpx);
  flex-direction: column;
  padding: 22rpx 24rpx calc(148rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.title-input {
  min-height: 92rpx;
  padding: 0 8rpx;
  color: #0b1f4d;
  font-size: 42rpx;
  font-weight: 700;
  line-height: 92rpx;
}

.note-editor {
  flex: 1;
  min-height: 58vh;
  margin-top: 16rpx;
  padding: 28rpx;
  border-radius: 26rpx;
  background: rgba(255, 255, 255, 0.96);
  color: #1f2937;
  font-size: 30rpx;
  line-height: 1.75;
  box-shadow: 0 18rpx 46rpx rgba(28, 55, 100, 0.06);
  box-sizing: border-box;
}

.toolbar {
  position: fixed;
  left: 20rpx;
  right: 20rpx;
  bottom: calc(20rpx + env(safe-area-inset-bottom));
  z-index: 20;
  display: flex;
  gap: 12rpx;
  overflow-x: auto;
  padding: 14rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20rpx 54rpx rgba(28, 55, 100, 0.14);
  box-sizing: border-box;
  white-space: nowrap;
}

.toolbar button {
  min-width: 72rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 18rpx;
  background: #eef4ff;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 650;
  line-height: 64rpx;
}

.toolbar button::after {
  border: none;
}

.toolbar button.danger {
  background: #fff1f2;
  color: #e11d48;
}

.preview-alert {
  margin: 24rpx 0;
  padding: 22rpx;
  border-radius: 20rpx;
  background: #eef6ff;
}

.preview-title {
  display: block;
  color: #0b1f4d;
  font-size: 27rpx;
  font-weight: 700;
}

.preview-desc {
  display: block;
  margin-top: 8rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.5;
}
</style>
