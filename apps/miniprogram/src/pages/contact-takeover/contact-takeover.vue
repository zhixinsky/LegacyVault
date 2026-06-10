<script setup lang="ts">
import { ref } from 'vue';
import { contactVaultSession } from '@/utils/api';
import { decryptContactVaultKey } from '@/utils/crypto-flow';
import {
  completeContactTakeover,
  listContactTakeoverChallenges,
  sendContactTakeoverOtp,
  startContactTakeover,
  verifyContactTakeoverChallenges,
  verifyContactTakeoverOtp,
} from '@/utils/services';

const step = ref(1);
const token = ref('');
const sessionId = ref('');
const otpChannel = ref(0);
const otpTarget = ref('');
const otpCode = ref('');
const challenges = ref<Array<{ id: string; questionLabel: string; answer: string }>>([]);
const resultMessage = ref('');

const channelOptions = [
  { label: '短信', value: 'sms' },
  { label: '邮箱', value: 'email' },
];

async function handleStart() {
  try {
    const result = await startContactTakeover(token.value.trim());
    sessionId.value = result.sessionId;
    step.value = 2;
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '令牌无效', icon: 'none' });
  }
}

async function handleSendOtp() {
  try {
    await sendContactTakeoverOtp(sessionId.value, {
      channel: channelOptions[otpChannel.value]?.value as 'sms' | 'email',
      target: otpTarget.value.trim(),
    });
    uni.showToast({ title: '验证码已发送', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '发送失败', icon: 'none' });
  }
}

async function handleVerifyOtp() {
  try {
    await verifyContactTakeoverOtp(sessionId.value, otpCode.value.trim());
    const result = await listContactTakeoverChallenges(sessionId.value);
    challenges.value = result.items.map((item) => ({
      id: item.id,
      questionLabel: item.questionLabel,
      answer: '',
    }));
    step.value = 3;
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '验证失败', icon: 'none' });
  }
}

async function handleVerifyChallenges() {
  try {
    await verifyContactTakeoverChallenges(
      sessionId.value,
      challenges.value.map((item) => ({ challengeId: item.id, answer: item.answer })),
    );
    const result = await completeContactTakeover(sessionId.value);
    if (result.pendingMultiContact) {
      uni.showModal({
        title: '等待其他联系人',
        content: `已验证通过，尚需 ${result.requiredCount} 位联系人共同确认（当前 ${result.completedCount}/${result.requiredCount}）。全部完成后请再次提交。`,
        showCancel: false,
      });
      return;
    }
    if (!result.encryptedVaultKeyForContact) {
      throw new Error('未获取到保险箱密钥');
    }
    const primaryAnswer = challenges.value[0]?.answer ?? '';
    const vaultKey = await decryptContactVaultKey(
      result.encryptedVaultKeyForContact,
      primaryAnswer,
    );
    contactVaultSession.setSession(sessionId.value, vaultKey);
    uni.navigateTo({ url: '/pages/contact-vault/contact-vault' });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '验证失败', icon: 'none' });
  }
}

function onChannelChange(event: { detail: { value: string | number } }) {
  otpChannel.value = Number(event.detail.value);
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">安全联系人接管</text>
      <text class="subtitle">使用通知中的接管令牌完成验证</text>

      <view v-if="step === 1" class="form">
        <input v-model="token" class="input" placeholder="接管令牌" />
        <button class="btn btn-primary" @tap="handleStart">开始验证</button>
      </view>

      <view v-else-if="step === 2" class="form">
        <picker :range="channelOptions" range-key="label" :value="otpChannel" @change="onChannelChange">
          <view class="picker-value">{{ channelOptions[otpChannel]?.label }}</view>
        </picker>
        <input v-model="otpTarget" class="input" placeholder="手机号或邮箱" />
        <button class="btn btn-secondary" @tap="handleSendOtp">发送验证码</button>
        <input v-model="otpCode" class="input" placeholder="6 位验证码" />
        <button class="btn btn-primary" @tap="handleVerifyOtp">验证并继续</button>
      </view>

      <view v-else-if="step === 3" class="form">
        <view v-for="item in challenges" :key="item.id" class="field">
          <text class="field-label">{{ item.questionLabel }}</text>
          <input v-model="item.answer" class="input" placeholder="请输入答案" />
        </view>
        <button class="btn btn-primary" @tap="handleVerifyChallenges">提交验证</button>
      </view>

      <view v-else class="success-box">
        <text>{{ resultMessage }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.form {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
}

.input {
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
}

.success-box {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #ecfdf5;
  color: #047857;
  font-size: 26rpx;
}
</style>
