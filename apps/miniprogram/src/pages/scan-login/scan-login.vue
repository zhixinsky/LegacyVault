<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getToken } from '@/utils/api';
import { approveScanLogin, confirmScanLogin } from '@/utils/services';

const scanId = ref('');
const loading = ref(false);
const confirmed = ref(false);

onLoad((query) => {
  const scene = typeof query?.scene === 'string' ? decodeURIComponent(query.scene) : '';
  scanId.value = scene || (typeof query?.scanId === 'string' ? query.scanId : '');
});

async function handleConfirm() {
  if (!scanId.value) {
    uni.showToast({ title: '无效的扫码会话', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const token = getToken();
    if (token) {
      await approveScanLogin(scanId.value);
    } else {
      const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
        uni.login({ provider: 'weixin', success: resolve, fail: reject });
      });
      if (!loginRes.code) {
        throw new Error('微信登录失败');
      }
      await confirmScanLogin(scanId.value, loginRes.code);
    }

    confirmed.value = true;
    uni.showToast({ title: '已确认网页登录', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '确认失败',
      icon: 'none',
      duration: 3000,
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">确认网页登录</text>
      <text class="subtitle">您正在授权 VaultPass 网页端登录</text>

      <view v-if="!scanId" class="hint-box">
        <text class="hint">未识别扫码会话，请重新扫描 PC 端二维码</text>
      </view>

      <view v-else-if="confirmed" class="hint-box success">
        <text class="hint">已确认，请返回电脑继续操作</text>
      </view>

      <view v-else class="actions">
        <text class="session-id">会话：{{ scanId }}</text>
        <button class="btn btn-primary" :loading="loading" @tap="handleConfirm">
          确认登录
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.container {
  min-height: 100vh;
  padding: 48rpx 32rpx;
  background: #f1f5f9;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
}

.title {
  display: block;
  font-size: 40rpx;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #64748b;
}

.hint-box {
  margin-top: 40rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #fef3c7;
}

.hint-box.success {
  background: #d1fae5;
}

.hint {
  font-size: 28rpx;
  color: #334155;
}

.actions {
  margin-top: 40rpx;
}

.session-id {
  display: block;
  margin-bottom: 24rpx;
  font-size: 22rpx;
  color: #94a3b8;
  word-break: break-all;
}

.btn-primary {
  background: #2563eb;
  color: #fff;
  border-radius: 16rpx;
}
</style>
