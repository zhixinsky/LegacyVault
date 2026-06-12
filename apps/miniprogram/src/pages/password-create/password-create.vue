<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptVaultPayload, decryptVaultTitle, encryptVaultItemPayload } from '@/utils/crypto-flow';
import { createVaultItem, getVaultItem, updateVaultItem } from '@/utils/services';

const editId = ref('');
const title = ref('');
const platform = ref('');
const username = ref('');
const password = ref('');
const website = ref('');
const note = ref('');
const loading = ref(false);

onLoad((query) => {
  editId.value = String(query?.id ?? '');
  if (editId.value) {
    loadItem();
  }
});

async function loadItem() {
  loading.value = true;
  try {
    const item = await getVaultItem(editId.value);
    title.value = await decryptVaultTitle(item.titleCiphertext);
    const payload = await decryptVaultPayload<{
      platform?: string;
      username?: string;
      address?: string;
      provider?: string;
      host?: string;
      password?: string;
      website?: string;
      note?: string;
    }>(item.encryptedPayload);
    platform.value = payload.platform ?? payload.provider ?? payload.host ?? '';
    username.value = payload.username ?? payload.address ?? '';
    password.value = payload.password ?? '';
    website.value = payload.website ?? '';
    note.value = payload.note ?? '';
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!title.value || !username.value || !password.value) {
    uni.showToast({ title: '请填写标题、账号和密码', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const encrypted = await encryptVaultItemPayload(
      {
        platform: platform.value,
        provider: platform.value,
        username: username.value,
        address: username.value,
        password: password.value,
        website: website.value,
        note: note.value,
      },
      title.value,
    );

    if (editId.value) {
      await updateVaultItem(editId.value, {
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    } else {
      await createVaultItem({
        type: 'password',
        titleCiphertext: encrypted.titleCiphertext,
        encryptedPayload: encrypted.encryptedPayload,
      });
    }

    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 500);
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '保存失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">{{ editId ? '编辑账号密码' : '新增账号密码' }}</text>
      <text class="subtitle">内容将在本地加密后上传，服务器无法查看明文</text>

      <text class="field-label">标题</text>
      <input v-model="title" class="input" placeholder="例如：GitHub" />

      <text class="field-label">平台</text>
      <input v-model="platform" class="input" placeholder="平台名称" />

      <text class="field-label">账号</text>
      <input v-model="username" class="input" placeholder="登录账号" />

      <text class="field-label">密码</text>
      <input v-model="password" class="input" password placeholder="登录密码" />

      <text class="field-label">网址</text>
      <input v-model="website" class="input" placeholder="https://" />

      <text class="field-label">备注</text>
      <textarea v-model="note" class="textarea" placeholder="可选备注" />

      <button class="btn btn-primary" :loading="loading" @tap="handleSave">加密保存</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';
</style>
