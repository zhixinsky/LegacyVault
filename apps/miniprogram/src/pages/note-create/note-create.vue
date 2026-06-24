<script setup lang="ts">
import { friendlyErrorMessage } from '@/utils/errors';
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import {
  getRichNoteFeatureSummary,
  isMiniEditableRichNote,
  normalizeRichNotePayload,
  plainTextToRichNotePayload,
  richNoteToPlainText,
  type RichNotePayload,
} from '@/utils/rich-note';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

const editId = ref('');
const title = ref('');
const content = ref('');
const saving = ref(false);
const readonlyPreview = ref(false);
const richFeatures = ref<string[]>([]);

onLoad((query) => {
  editId.value = String(query?.id ?? '');
  if (editId.value) {
    loadItem();
  }
});

async function loadItem() {
  saving.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = normalizeRichNotePayload(await decryptVaultPayload<RichNotePayload>(item.encryptedPayload));
    content.value = richNoteToPlainText(payload);
    richFeatures.value = getRichNoteFeatureSummary(payload);
    readonlyPreview.value = !isMiniEditableRichNote(payload);
  } catch (error) {
    uni.showToast({ title: friendlyErrorMessage(error, '加载失败'), icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function handleSave() {
  if (readonlyPreview.value) {
    uni.showToast({ title: '复杂富文本请在电脑端编辑', icon: 'none' });
    return;
  }

  if (!title.value || !content.value) {
    uni.showToast({ title: '请填写标题和内容', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    const encrypted = await encryptVaultItemPayload(plainTextToRichNotePayload(content.value), title.value);
    if (editId.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      await createVaultItem({
        type: 'note',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    }
    uni.showToast({ title: '已保存', icon: 'success' });
    uni.navigateBack();
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
  <view class="container">
    <view class="card">
      <text class="title">{{ editId ? '编辑私密笔记' : '新增私密笔记' }}</text>
      <input v-model="title" class="input" :disabled="readonlyPreview" placeholder="标题" />
      <view v-if="readonlyPreview" class="preview-alert">
        <text class="preview-title">此笔记包含电脑端富文本内容</text>
        <text class="preview-desc">
          已为您以预览方式打开，包含 {{ richFeatures.join('、') }}。请在 PC 端编辑完整内容，避免覆盖表格、媒体或附件。
        </text>
      </view>
      <textarea
        v-model="content"
        class="textarea"
        :disabled="readonlyPreview"
        :placeholder="readonlyPreview ? '富文本预览' : '笔记内容'"
      />
      <text class="hint">
        小程序支持基础文字编辑；PC 端创建的表格、代码块、图片、视频和附件会在这里保持预览，不会被误覆盖。
      </text>
      <button
        class="btn btn-primary"
        :disabled="readonlyPreview"
        :loading="saving"
        @tap="handleSave"
      >
        {{ readonlyPreview ? '请在 PC 端编辑' : '加密保存' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.preview-alert {
  margin-bottom: 20rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(30, 77, 255, 0.16);
  border-radius: 20rpx;
  background: #eef6ff;
}

.preview-title {
  display: block;
  color: #0b1f4d;
  font-size: 28rpx;
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
