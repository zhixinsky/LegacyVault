<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

const editId = ref('');
const title = ref('');
const content = ref('');
const saving = ref(false);

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
    const payload = await decryptVaultPayload<{ content?: string }>(item.encryptedPayload);
    content.value = payload.content ?? '';
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function handleSave() {
  if (!title.value || !content.value) {
    uni.showToast({ title: '请填写标题和内容', icon: 'none' });
    return;
  }

  saving.value = true;
  try {
    const encrypted = await encryptVaultItemPayload({ content: content.value }, title.value);
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
      title: error instanceof Error ? error.message : '保存失败',
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
      <input v-model="title" class="input" placeholder="标题" />
      <textarea v-model="content" class="textarea" placeholder="笔记内容" />
      <button class="btn btn-primary" :loading="saving" @tap="handleSave">加密保存</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';
</style>
