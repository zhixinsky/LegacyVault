<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { vaultSession } from '@/utils/api';
import {
  buildRecoveredMasterPasswordPayload,
  unlockVaultWithMasterPassword,
} from '@/utils/crypto-flow';
import { getProfile, heartbeat, recoverMasterPassword } from '@/utils/services';

type UnlockMode = 'master' | 'recovery';
type UnlockStatus = 'idle' | 'running' | 'error' | 'success';

const unlockMode = ref<UnlockMode>('master');
const masterPassword = ref('');
const recoveryKey = ref('');
const newMasterPassword = ref('');
const confirmMasterPassword = ref('');
const recoveryConfigured = ref(false);
const isUnlocking = ref(false);
const showPassword = ref(false);
const showRecoveryKey = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
const progress = ref(0);
const currentStep = ref(0);
const unlockStatus = ref<UnlockStatus>('idle');
const statusText = ref('正在执行安全计算...');
const errorMessage = ref('');
const failedAttempts = ref(0);

const heroBackgroundUrl =
  'cloud://prod-d4g8kpg7x92d55205.7072-prod-d4g8kpg7x92d55205-1441616383/img/bg.webp';

const progressSteps = ['验证主密码', '生成解密密钥', '解锁保险箱', '加载数据'];

function waitForPaint(delay = 100) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
}

function setProgress(value: number, step: number, text = '正在执行安全计算...') {
  progress.value = unlockStatus.value === 'running' ? Math.max(progress.value, value) : value;
  currentStep.value = step;
  statusText.value = text;
}

async function rampProgress(stages: Array<{ value: number; step: number; text: string; delay: number }>) {
  for (const stage of stages) {
    setProgress(stage.value, stage.step, stage.text);
    await nextTick();
    await waitForPaint(stage.delay);
  }
}

async function animateWhilePending<T>(task: Promise<T>, target: number, step: number, text: string) {
  let settled = false;
  const guardedTask = task.finally(() => {
    settled = true;
  });

  while (!settled && progress.value < target) {
    const nextValue = progress.value < 70 ? progress.value + 2 : progress.value + 1;
    setProgress(Math.min(target, nextValue), step, text);
    await nextTick();
    await waitForPaint(progress.value < 70 ? 90 : progress.value < 90 ? 150 : 420);
  }

  return guardedTask;
}

function resetUnlockProgress() {
  progress.value = 0;
  currentStep.value = 0;
  unlockStatus.value = 'idle';
  statusText.value = '正在执行安全计算...';
  errorMessage.value = '';
}

function switchMode(mode: UnlockMode) {
  if (isUnlocking.value) return;
  unlockMode.value = mode;
  resetUnlockProgress();
}

function getStepClass(index: number) {
  if (unlockStatus.value === 'error' && index === currentStep.value) return 'error';
  if (progress.value >= 100 || index < currentStep.value) return 'done';
  if (index === currentStep.value && isUnlocking.value) return 'active';
  return 'pending';
}

function getStepMark(index: number) {
  const stepClass = getStepClass(index);
  if (stepClass === 'done') return '✓';
  if (stepClass === 'error') return '!';
  if (index === 0) return '锁';
  if (index === 1) return '钥';
  if (index === 2) return '箱';
  return '数';
}

onLoad(async () => {
  try {
    const profile = await getProfile();
    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;
    if (profile.vaultKeyBundle) {
      vaultSession.setKeyBundle(profile.vaultKeyBundle);
    }
    if (profile.encryptedVaultKeyByRecovery) {
      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);
    }
    if (profile.recoverySalt) {
      vaultSession.setRecoverySalt(profile.recoverySalt);
    }
  } catch {
    // ignore
  }
});

async function handleUnlock() {
  if (isUnlocking.value) return;

  if (unlockMode.value === 'master' && !masterPassword.value) {
    uni.showToast({ title: '请输入主密码', icon: 'none' });
    return;
  }
  if (unlockMode.value === 'recovery' && !recoveryKey.value) {
    uni.showToast({ title: '请输入恢复密钥', icon: 'none' });
    return;
  }
  if (unlockMode.value === 'recovery' && newMasterPassword.value.length < 12) {
    uni.showToast({ title: '新主密码至少 12 位', icon: 'none' });
    return;
  }
  if (unlockMode.value === 'recovery' && newMasterPassword.value !== confirmMasterPassword.value) {
    uni.showToast({ title: '两次输入的新主密码不一致', icon: 'none' });
    return;
  }

  isUnlocking.value = true;
  unlockStatus.value = 'running';
  errorMessage.value = '';
  setProgress(10, 0, '准备在本地验证主密码...');

  try {
    await nextTick();
    await waitForPaint(120);

    if (unlockMode.value === 'master') {
      await rampProgress([
        { value: 18, step: 0, text: '正在检查本地密钥包...', delay: 120 },
        { value: 26, step: 0, text: '正在准备零知识解锁环境...', delay: 140 },
        { value: 34, step: 1, text: '即将生成解密密钥...', delay: 160 },
      ]);
      const unlockTask = unlockVaultWithMasterPassword(masterPassword.value, {
        beforeDerive: () => setProgress(40, 1, '正在进行本地安全计算，主密码不会上传服务器...'),
        afterDerive: () => setProgress(96, 2, '解密密钥已生成，正在打开保险箱...'),
        afterDecrypt: () => setProgress(98, 3, '密钥解密成功，正在加载数据...'),
      });
      await animateWhilePending(
        unlockTask,
        99,
        1,
        '正在进行本地安全计算，主密码不会上传服务器...',
      );
    } else {
      await rampProgress([
        { value: 20, step: 0, text: '正在检查恢复密钥包...', delay: 120 },
        { value: 34, step: 1, text: '正在验证恢复密钥...', delay: 120 },
      ]);
      const bundle = vaultSession.getRecoveryBundle();
      if (!bundle) throw new Error('未配置恢复密钥');
      const recovered = await buildRecoveredMasterPasswordPayload(
        recoveryKey.value,
        bundle,
        newMasterPassword.value,
      );
      setProgress(72, 2, '正在保存新的主密码密钥包...');
      await recoverMasterPassword(recovered.payload);
      vaultSession.setKeyBundle(recovered.keyBundle);
      vaultSession.setVaultKey(recovered.vaultKey);
      setProgress(88, 3, '恢复成功，正在加载数据...');
    }

    void heartbeat().catch(() => undefined);
    await waitForPaint(120);
    setProgress(100, 3, '加载完成，即将进入保险箱...');
    unlockStatus.value = 'success';
    failedAttempts.value = 0;
    masterPassword.value = '';
    recoveryKey.value = '';
    newMasterPassword.value = '';
    confirmMasterPassword.value = '';
    await waitForPaint(220);
    uni.switchTab({ url: '/pages/vault/vault' });
  } catch (error) {
    failedAttempts.value += 1;
    unlockStatus.value = 'error';
    progress.value = 0;
    currentStep.value = 0;
    masterPassword.value = '';
    errorMessage.value =
      failedAttempts.value >= 5
        ? '尝试次数过多，请稍后再试或使用恢复密钥。'
        : error instanceof Error && error.message
          ? error.message.includes('decrypt') || error.message.includes('解密')
            ? '主密码错误，请重新输入'
            : error.message
          : '主密码错误，请重新输入';
    statusText.value = errorMessage.value;
  } finally {
    isUnlocking.value = false;
  }
}

function goLogin() {
  if (isUnlocking.value) return;
  vaultSession.logout();
  uni.reLaunch({ url: '/pages/login/login' });
}
</script>

<template>
  <view class="unlock-page">
    <image class="page-bg" :src="heroBackgroundUrl" mode="aspectFill" />

    <view class="hero">
      <view class="hero-copy">
        <text class="product-name">VaultPass · 数字资产库</text>
        <text class="title">解锁保险箱</text>
        <text class="subtitle">您的数据已多重加密保护，仅在本地解密，安全可靠。</text>
      </view>
    </view>

    <view class="card">
      <template v-if="unlockMode === 'master'">
        <text class="field-label">主密码</text>
        <view class="input-wrap">
          <input
            v-model="masterPassword"
            class="field-input"
            :password="!showPassword"
            placeholder="请输入主密码"
            placeholder-class="placeholder"
            :disabled="isUnlocking"
          />
          <button class="eye-button" :disabled="isUnlocking" @tap="showPassword = !showPassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
        </view>
        <view class="forgot-row">
          <button
            class="forgot-link"
            :disabled="!recoveryConfigured || isUnlocking"
            @tap="switchMode('recovery')"
          >
            忘记主密码？
          </button>
        </view>
      </template>

      <template v-else>
        <button class="back-link" :disabled="isUnlocking" @tap="switchMode('master')">返回主密码解锁</button>
        <view class="recovery-tip">
          <text>恢复密钥仅用于忘记主密码时重置主密码。验证成功后，后续仍使用新的主密码解锁保险箱。</text>
        </view>

        <text class="field-label">恢复密钥</text>
        <view class="input-wrap">
          <input
            v-model="recoveryKey"
            class="field-input"
            :password="!showRecoveryKey"
            placeholder="请输入恢复密钥"
            placeholder-class="placeholder"
            :disabled="isUnlocking"
          />
          <button class="eye-button" :disabled="isUnlocking" @tap="showRecoveryKey = !showRecoveryKey">
            {{ showRecoveryKey ? '隐藏' : '显示' }}
          </button>
        </view>

        <text class="field-label">新主密码</text>
        <view class="input-wrap">
          <input
            v-model="newMasterPassword"
            class="field-input"
            :password="!showNewPassword"
            placeholder="至少 12 位的新主密码"
            placeholder-class="placeholder"
            :disabled="isUnlocking"
          />
          <button class="eye-button" :disabled="isUnlocking" @tap="showNewPassword = !showNewPassword">
            {{ showNewPassword ? '隐藏' : '显示' }}
          </button>
        </view>

        <text class="field-label">确认新主密码</text>
        <view class="input-wrap">
          <input
            v-model="confirmMasterPassword"
            class="field-input"
            :password="!showConfirmPassword"
            placeholder="再次输入新主密码"
            placeholder-class="placeholder"
            :disabled="isUnlocking"
          />
          <button class="eye-button" :disabled="isUnlocking" @tap="showConfirmPassword = !showConfirmPassword">
            {{ showConfirmPassword ? '隐藏' : '显示' }}
          </button>
        </view>
      </template>

      <view class="security-card">
        <view class="security-icon">
          <image src="/static/icons/login/shield-solid.svg" mode="aspectFit" />
        </view>
        <view class="security-copy">
          <text class="security-title">主密码不会上传服务器</text>
          <text class="security-text">平台和开发者均无法查看您的内容</text>
        </view>
      </view>

      <button
        class="primary-button"
        :class="{ disabled: isUnlocking }"
        :disabled="isUnlocking"
        @tap="handleUnlock"
      >
        <image class="button-lock" src="/static/icons/login/lock.svg" mode="aspectFit" />
        <text>{{ isUnlocking ? '正在解锁保险箱...' : unlockMode === 'master' ? '解锁保险箱' : '重置主密码并进入' }}</text>
      </button>

      <view v-if="unlockStatus !== 'idle'" :class="['progress-card', unlockStatus]">
        <view class="progress-head">
          <view>
            <text class="progress-title">
              {{ unlockStatus === 'error' ? '解锁失败' : '正在本地解锁保险箱' }}
            </text>
            <text class="progress-subtitle">
              {{ unlockStatus === 'error' ? errorMessage : '验证主密码并解密密钥，过程可能需要几秒，请稍候。' }}
            </text>
          </view>
          <text class="secure-badge">零知识加密</text>
        </view>

        <view class="step-row">
          <view v-for="(step, index) in progressSteps" :key="step" class="step-item">
            <view :class="['step-dot', getStepClass(index)]">
              <text>{{ getStepMark(index) }}</text>
            </view>
            <text :class="['step-label', getStepClass(index)]">{{ step }}</text>
          </view>
        </view>

        <view class="progress-row">
          <view class="progress-track">
            <view
              :class="['progress-fill', unlockStatus]"
              :style="{ width: `${progress}%` }"
            />
          </view>
          <text :class="['progress-percent', unlockStatus]">{{ progress }}%</text>
        </view>
        <text :class="['status-text', unlockStatus]">{{ statusText }}</text>
      </view>

      <button class="ghost-button" :disabled="isUnlocking" @tap="goLogin">切换账号</button>
    </view>

    <view class="tip-card">
      <text class="tip-title">小贴士</text>
      <text class="tip-text">解锁过程在本地完成，主密码越复杂，安全性越高。</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

button {
  margin: 0;
  padding: 0;
}

button::after {
  border: none;
}

.unlock-page {
  position: relative;
  min-height: 100vh;
  padding: 76rpx 32rpx 46rpx;
  background: linear-gradient(180deg, #f4f8ff 0%, #eef5ff 100%);
  box-sizing: border-box;
  overflow: hidden;
}

.page-bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.38;
  z-index: 0;
}

.hero,
.card,
.tip-card {
  position: relative;
  z-index: 1;
}

.hero {
  display: flex;
  min-height: 330rpx;
  align-items: center;
  justify-content: flex-start;
  padding: 28rpx 8rpx 36rpx;
  box-sizing: border-box;
}

.hero-copy {
  flex: 1;
  min-width: 0;
  padding-right: 12rpx;
}

.product-name {
  display: block;
  margin-bottom: 18rpx;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 600;
}

.title {
  display: block;
  color: #0b1f4d;
  font-size: 54rpx;
  font-weight: 900;
  line-height: 1.12;
}

.subtitle {
  display: block;
  margin-top: 26rpx;
  max-width: 610rpx;
  color: #64748b;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.65;
}

.card {
  padding: 46rpx 34rpx 34rpx;
  border-radius: 42rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18rpx 56rpx rgba(11, 31, 77, 0.1);
}

.field-label {
  display: block;
  margin-bottom: 14rpx;
  color: #0b1f4d;
  font-size: 25rpx;
  font-weight: 700;
}

.field-label:not(:first-child) {
  margin-top: 28rpx;
}

.input-wrap {
  display: flex;
  height: 88rpx;
  align-items: center;
  border: 1rpx solid #e1e8f0;
  border-radius: 22rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.field-input {
  flex: 1;
  min-width: 0;
  height: 86rpx;
  padding: 0 22rpx;
  color: #0b1f4d;
  font-size: 27rpx;
  box-sizing: border-box;
}

.placeholder {
  color: #a6b3c6;
}

.eye-button {
  width: 116rpx;
  height: 86rpx;
  background: transparent;
  color: #8291a8;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 86rpx;
}

.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
}

.forgot-link,
.back-link {
  background: transparent;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1.4;
}

.forgot-link[disabled],
.back-link[disabled] {
  color: #aab6c8;
}

.back-link {
  margin-bottom: 22rpx;
}

.recovery-tip {
  margin-bottom: 26rpx;
  padding: 22rpx 24rpx;
  border-radius: 20rpx;
  background: #fff7ed;
  color: #9a3412;
  font-size: 24rpx;
  line-height: 1.55;
}

.security-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-top: 34rpx;
  padding: 26rpx 24rpx;
  border-radius: 20rpx;
  background: #eef6ff;
}

.security-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 36rpx;
  background: rgba(30, 77, 255, 0.12);
}

.security-icon image {
  width: 42rpx;
  height: 42rpx;
}

.security-copy {
  flex: 1;
  min-width: 0;
}

.security-title {
  display: block;
  color: #0b1f4d;
  font-size: 26rpx;
  font-weight: 700;
}

.security-text {
  display: block;
  margin-top: 10rpx;
  color: #64748b;
  font-size: 25rpx;
  line-height: 1.45;
}

.primary-button {
  display: flex;
  height: 92rpx;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 36rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #3d83ff 0%, #1e4dff 100%);
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 92rpx;
  box-shadow: 0 12rpx 26rpx rgba(30, 77, 255, 0.24);
}

.primary-button.disabled {
  opacity: 0.9;
}

.button-lock {
  width: 32rpx;
  height: 32rpx;
  filter: brightness(0) invert(1);
}

.progress-card {
  margin-top: 34rpx;
  padding: 28rpx 24rpx 30rpx;
  border: 1rpx solid #dce6f4;
  border-radius: 20rpx;
  background: #ffffff;
}

.progress-card.error {
  border-color: rgba(239, 68, 68, 0.28);
  background: #fffafa;
}

.progress-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.progress-title {
  display: block;
  color: #0b1f4d;
  font-size: 28rpx;
  font-weight: 700;
}

.progress-subtitle {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 24rpx;
  line-height: 1.45;
}

.secure-badge {
  flex: 0 0 auto;
  padding: 10rpx 16rpx;
  border-radius: 16rpx;
  background: #eef6ff;
  color: #1e4dff;
  font-size: 22rpx;
  font-weight: 700;
}

.step-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 36rpx;
}

.step-item {
  display: flex;
  width: 25%;
  align-items: center;
  flex-direction: column;
}

.step-dot {
  display: flex;
  width: 70rpx;
  height: 70rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #dce4f0;
  border-radius: 50%;
  background: #ffffff;
  color: #96a3b5;
  font-size: 24rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.step-dot.active {
  border-color: rgba(30, 77, 255, 0.22);
  background: #1e4dff;
  color: #ffffff;
  box-shadow: 0 0 0 12rpx rgba(30, 77, 255, 0.08);
}

.step-dot.done {
  border-color: #22c55e;
  background: #22c55e;
  color: #ffffff;
}

.step-dot.error {
  border-color: #ef4444;
  background: #ef4444;
  color: #ffffff;
}

.step-label {
  display: block;
  margin-top: 16rpx;
  color: #64748b;
  font-size: 22rpx;
  font-weight: 600;
  text-align: center;
  line-height: 1.3;
}

.step-label.active {
  color: #1e4dff;
}

.step-label.done {
  color: #22c55e;
}

.step-label.error {
  color: #ef4444;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 34rpx;
}

.progress-track {
  flex: 1;
  height: 20rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: #e8edf7;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f80ff, #1e4dff);
  transition: width 220ms ease;
}

.progress-fill.error {
  background: #ef4444;
}

.progress-percent {
  min-width: 76rpx;
  color: #1e4dff;
  font-size: 28rpx;
  font-weight: 700;
  text-align: right;
}

.progress-percent.error {
  color: #ef4444;
}

.status-text {
  display: block;
  margin-top: 26rpx;
  color: #64748b;
  font-size: 26rpx;
}

.status-text.error {
  color: #ef4444;
  font-weight: 700;
}

.ghost-button {
  height: 78rpx;
  margin-top: 20rpx;
  border-radius: 22rpx;
  background: #eef3ff;
  color: #1e4dff;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 78rpx;
}

.ghost-button[disabled] {
  color: #9aa8bc;
}

.tip-card {
  margin-top: 42rpx;
  padding: 28rpx 32rpx;
  border-radius: 24rpx;
  background: rgba(238, 246, 255, 0.88);
  box-shadow: 0 14rpx 38rpx rgba(11, 31, 77, 0.06);
}

.tip-title {
  display: block;
  color: #0b1f4d;
  font-size: 27rpx;
  font-weight: 700;
}

.tip-text {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 25rpx;
  line-height: 1.55;
}
</style>
