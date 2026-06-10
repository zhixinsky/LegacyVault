<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { confirmWxBindScan } from '@/utils/services';

const bindId = ref('');
const loading = ref(false);
const confirmed = ref(false);

onLoad((query) => {
  const scene = typeof query?.scene === 'string' ? decodeURIComponent(query.scene) : '';
  bindId.value = scene || (typeof query?.bindId === 'string' ? query.bindId : '');
});

async function handleConfirm() {
  if (!bindId.value) {
    uni.showToast({ title: '无效的绑定会话', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const loginRes = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject });
    });
    if (!loginRes.code) {
      throw new Error('微信登录失败');
    }

    await confirmWxBindScan(bindId.value, loginRes.code);

    confirmed.value = true;
    uni.showToast({ title: '微信已绑定', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '绑定失败',
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
      <text class="title">确认绑定微信</text>
      <text class="subtitle">您正在将微信绑定到 VaultPass 网页账户</text>

      <view v-if="!bindId" class="hint-box">
        <text class="hint">未识别绑定会话，请重新扫描网页端二维码</text>
      </view>

      <view v-else-if="confirmed" class="hint-box success">
        <text class="hint">绑定成功，请返回电脑继续操作</text>
      </view>

      <view v-else class="actions">
        <button class="btn btn-primary" :loading="loading" @tap="handleConfirm">
          确认绑定
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
</style>
