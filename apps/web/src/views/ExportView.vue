<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { buildVaultExportData, downloadExportJson } from '@/utils/export-data';
import { getProfile, logDataExport, verifyMfa } from '@/utils/services';

const exporting = ref(false);
const mfaEnabled = ref(false);
const mfaCode = ref('');
const message = ref('');
const error = ref('');

onMounted(async () => {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
});

async function handleExport() {
  exporting.value = true;
  message.value = '';
  error.value = '';

  try {
    if (mfaEnabled.value) {
      if (!mfaCode.value) {
        throw new Error('已启用二次验证，请先输入验证码');
      }
      await verifyMfa(mfaCode.value);
    }
    await logDataExport(mfaCode.value || undefined);
    const exportData = await buildVaultExportData();
    downloadExportJson(exportData);

    message.value = '导出完成。请妥善保管导出文件。';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导出失败';
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
    <h2 class="text-xl font-bold text-slate-900">数据导出</h2>
    <p class="mt-2 text-sm text-slate-500">
      在本地解密账号密码与联系人信息后导出 JSON。此操作属于高风险行为，服务器会记录审计日志。
    </p>

    <ul class="mt-6 list-disc space-y-2 pl-5 text-sm text-slate-600">
      <li>导出内容：账号密码、敏感账户、私密笔记、联系人（明文）</li>
      <li>文件与相册：仅导出元数据</li>
      <li>请勿将导出文件存储在不安全的位置</li>
    </ul>

    <input
      v-if="mfaEnabled"
      v-model="mfaCode"
      class="mt-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      placeholder="输入二次验证码"
    />

    <VButton class="mt-8" variant="primary" :disabled="exporting" @click="handleExport">
      {{ exporting ? '导出中...' : '导出解密数据' }}
    </VButton>

    <p v-if="message" class="mt-4 text-sm text-emerald-600">{{ message }}</p>
    <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
  </div>
</template>

<style scoped>
:deep(.vp-btn) {
  margin-top: 2rem;
}
</style>
