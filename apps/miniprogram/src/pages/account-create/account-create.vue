<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { getVaultItemTypeConfig, isManagedVaultType } from '@vaultpass/types';
import { encryptVaultItemPayload } from '@/utils/crypto-flow';
import { createVaultItem } from '@/utils/services';

const vaultType = ref('');
const config = computed(() => getVaultItemTypeConfig(vaultType.value));
const title = ref('');
const form = ref<Record<string, string>>({});
const loading = ref(false);

onLoad((query) => {
  const type = String(query?.type ?? '');
  if (!isManagedVaultType(type)) {
    uni.redirectTo({ url: '/pages/accounts-hub/accounts-hub' });
    return;
  }
  vaultType.value = type;
  uni.setNavigationBarTitle({ title: `新增${getVaultItemTypeConfig(type)?.shortLabel ?? ''}账户` });
});

async function handleSave() {
  if (!config.value) return;
  if (!title.value.trim()) {
    uni.showToast({ title: '请填写标题', icon: 'none' });
    return;
  }
  for (const field of config.value.fields) {
    if (field.required && !form.value[field.key]?.trim()) {
      uni.showToast({ title: `请填写${field.label}`, icon: 'none' });
      return;
    }
  }

  loading.value = true;
  try {
    const encrypted = await encryptVaultItemPayload({ ...form.value }, title.value.trim());
    await createVaultItem({
      type: vaultType.value,
      titleCiphertext: encrypted.titleCiphertext,
      encryptedPayload: encrypted.encryptedPayload,
    });
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
      <text class="title">新增{{ config?.label }}</text>
      <text class="subtitle">内容将在本地加密后上传</text>

      <text class="field-label">标题</text>
      <input v-model="title" class="input" placeholder="例如：华泰证券主账户" />

      <template v-for="field in config?.fields" :key="field.key">
        <text class="field-label">
          {{ field.label }}<text v-if="field.required" class="required">*</text>
        </text>
        <textarea
          v-if="field.inputType === 'textarea'"
          v-model="form[field.key]"
          class="textarea"
          :placeholder="field.placeholder"
        />
        <input
          v-else
          v-model="form[field.key]"
          class="input"
          :password="field.inputType === 'password'"
          :placeholder="field.placeholder"
        />
      </template>

      <button class="btn btn-primary" :loading="loading" @tap="handleSave">加密保存</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.required {
  color: #dc2626;
}
</style>
