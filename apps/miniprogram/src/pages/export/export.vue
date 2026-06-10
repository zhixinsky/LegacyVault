<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { buildVaultExportData, saveExportJsonToLocal } from '@/utils/export-data';
import { getProfile, logDataExport, verifyMfa } from '@/utils/services';

const exporting = ref(false);
const mfaEnabled = ref(false);
const mfaCode = ref('');

onShow(async () => {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
});

async function handleExport() {
  exporting.value = true;
  try {
    if (mfaEnabled.value) {
      if (!mfaCode.value.trim()) {
        throw new Error('已启用二次验证，请先输入验证码');
      }
      await verifyMfa(mfaCode.value.trim());
    }

    await logDataExport(mfaCode.value.trim() || undefined);
    const exportData = await buildVaultExportData();
    const filePath = await saveExportJsonToLocal(exportData);

    uni.showModal({
      title: '导出完成',
      content: '解密数据已保存为 JSON 文件，请妥善保管，勿分享给他人。',
      confirmText: '打开文件',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          uni.openDocument({
            filePath,
            showMenu: true,
            fail: () => {
              uni.showToast({ title: '无法打开文件，请从文件管理器查看', icon: 'none' });
            },
          });
        }
      },
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '导出失败',
      icon: 'none',
    });
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">数据导出</text>
      <text class="subtitle">在本地解密后导出 JSON，服务器会记录审计日志</text>

      <view class="tips">
        <text class="tip-line">· 导出内容：账号密码、敏感账户、私密笔记、联系人（明文）</text>
        <text class="tip-line">· 文件与相册：仅导出元数据</text>
        <text class="tip-line">· 请勿将导出文件存储在不安全的位置</text>
      </view>

      <input
        v-if="mfaEnabled"
        v-model="mfaCode"
        class="input"
        placeholder="输入二次验证码"
      />

      <button class="btn btn-primary" :loading="exporting" @tap="handleExport">
        {{ exporting ? '导出中...' : '导出解密数据' }}
      </button>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.tips {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.tip-line {
  display: block;
  font-size: 24rpx;
  color: #475569;
  line-height: 1.8;
}
</style>
