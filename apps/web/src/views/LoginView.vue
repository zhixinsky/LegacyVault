<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import {
  isAuthResult,
  isMfaRequired,
  loginMfa,
  loginWithCode,
  loginWithEmailCode,
  loginWithPassword,
  persistAuthResult,
  register,
  sendEmailLoginCode,
  sendLoginCode,
  type AuthLoginResponse,
} from '@/utils/services';

type LoginMethod = 'phone' | 'password' | 'email';

const router = useRouter();
const activeMethod = ref<LoginMethod>('phone');
const phone = ref('');
const code = ref('');
const email = ref('');
const emailCode = ref('');
const username = ref('');
const password = ref('');
const loading = ref(false);
const sendingCode = ref(false);
const sendingEmailCode = ref(false);
const countdown = ref(0);
const emailCountdown = ref(0);
const error = ref('');
const agreed = ref(false);
const mfaPendingId = ref('');
const mfaCode = ref('');
const step = ref<'login' | 'mfa'>('login');

let countdownTimer: ReturnType<typeof setInterval> | null = null;
let emailCountdownTimer: ReturnType<typeof setInterval> | null = null;

function startCountdown(target: typeof countdown | typeof emailCountdown, timer: 'phone' | 'email') {
  target.value = 60;
  const currentTimer = timer === 'phone' ? countdownTimer : emailCountdownTimer;
  if (currentTimer) clearInterval(currentTimer);

  const nextTimer = setInterval(() => {
    target.value -= 1;
    if (target.value <= 0) {
      clearInterval(nextTimer);
      if (timer === 'phone') countdownTimer = null;
      else emailCountdownTimer = null;
    }
  }, 1000);

  if (timer === 'phone') countdownTimer = nextTimer;
  else emailCountdownTimer = nextTimer;
}

function ensureAgreed() {
  if (!agreed.value) {
    error.value = '请先阅读并同意用户协议和隐私政策';
    return false;
  }
  return true;
}

function routeAfterAuth(result: Extract<AuthLoginResponse, { accessToken: string }>) {
  persistAuthResult(result);
  if (result.user.phone) vaultSession.setPendingPhone(result.user.phone);
  if (!result.user.hasVault || !result.vaultKeyBundle) {
    router.push('/create-vault-password');
    return;
  }
  router.push('/unlock');
}

async function registerFromLogin(result?: Extract<AuthLoginResponse, { registered: false }>) {
  if (result?.phone) vaultSession.setPendingPhone(result.phone);
  if (result?.email) vaultSession.setPendingEmail(result.email);
  if (result?.username) {
    vaultSession.setPendingUsername(result.username);
    vaultSession.setPendingPassword(password.value);
  }

  const auth = await register({
    phone: vaultSession.getPendingPhone() || undefined,
    email: vaultSession.getPendingEmail() || undefined,
    username: vaultSession.getPendingUsername() || undefined,
    password: vaultSession.getPendingPassword() || undefined,
  });
  routeAfterAuth(auth);
  vaultSession.clearPendingRegisterIdentity();
}

async function handleLoginResult(result: AuthLoginResponse) {
  if (isMfaRequired(result)) {
    mfaPendingId.value = result.pendingId;
    step.value = 'mfa';
    return;
  }

  if (!isAuthResult(result)) {
    await registerFromLogin(result);
    return;
  }

  routeAfterAuth(result);
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = '请输入正确手机号';
    return;
  }
  if (countdown.value > 0) return;

  sendingCode.value = true;
  error.value = '';
  try {
    await sendLoginCode(phone.value);
    startCountdown(countdown, 'phone');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败';
  } finally {
    sendingCode.value = false;
  }
}

async function handleSendEmailCode() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = '请输入正确邮箱';
    return;
  }
  if (emailCountdown.value > 0) return;

  sendingEmailCode.value = true;
  error.value = '';
  try {
    await sendEmailLoginCode(email.value);
    startCountdown(emailCountdown, 'email');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败';
  } finally {
    sendingEmailCode.value = false;
  }
}

async function handlePhoneLogin() {
  if (!ensureAgreed()) return;
  if (!/^1\d{10}$/.test(phone.value)) {
    error.value = '请输入正确手机号';
    return;
  }
  if (!/^\d{6}$/.test(code.value)) {
    error.value = '请输入 6 位验证码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await handleLoginResult(await loginWithCode(phone.value, code.value));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

async function handlePasswordLogin() {
  if (!ensureAgreed()) return;
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username.value)) {
    error.value = '用户名仅支持 3-32 位字母、数字或下划线';
    return;
  }
  if (!password.value || password.value.length < 6) {
    error.value = '请输入至少 6 位登录密码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await handleLoginResult(await loginWithPassword(username.value, password.value));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

async function handleEmailLogin() {
  if (!ensureAgreed()) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    error.value = '请输入正确邮箱';
    return;
  }
  if (!/^\d{6}$/.test(emailCode.value)) {
    error.value = '请输入 6 位邮箱验证码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    await handleLoginResult(await loginWithEmailCode(email.value, emailCode.value));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败';
  } finally {
    loading.value = false;
  }
}

function goLogin() {
  if (activeMethod.value === 'phone') void handlePhoneLogin();
  else if (activeMethod.value === 'password') void handlePasswordLogin();
  else void handleEmailLogin();
}

async function submitMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    error.value = '请输入 6 位二次验证码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    routeAfterAuth(await loginMfa(mfaPendingId.value, mfaCode.value));
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="hero">
      <p class="eyebrow">Welcome to</p>
      <h1>LegacyVault</h1>
      <p class="subtitle">您的数字保险箱</p>
      <p class="security-line">端到端加密 · 只有您可以访问</p>
    </div>

    <div class="login-card">
      <template v-if="step === 'mfa'">
        <h2>二次验证</h2>
        <p class="muted">检测到新设备登录，请输入二次验证码。</p>
        <label>二次验证码</label>
        <input v-model="mfaCode" maxlength="6" placeholder="6 位 TOTP 验证码" />
        <p v-if="error" class="error">{{ error }}</p>
        <VButton class="mt-6 w-full" variant="primary" :disabled="loading" @click="submitMfa">
          {{ loading ? '验证中...' : '完成登录' }}
        </VButton>
        <VButton class="mt-3 w-full" variant="secondary" @click="step = 'login'">返回</VButton>
      </template>

      <template v-else>
        <div class="method-tabs">
          <button :class="{ active: activeMethod === 'phone' }" @click="activeMethod = 'phone'">手机号验证码</button>
          <button :class="{ active: activeMethod === 'password' }" @click="activeMethod = 'password'">用户名密码</button>
          <button :class="{ active: activeMethod === 'email' }" @click="activeMethod = 'email'">邮箱验证码</button>
        </div>

        <template v-if="activeMethod === 'phone'">
          <label>手机号</label>
          <input v-model="phone" type="tel" maxlength="11" placeholder="请输入手机号" />
          <label>验证码</label>
          <div class="code-row">
            <input v-model="code" maxlength="6" placeholder="请输入 6 位验证码" />
            <VButton variant="secondary" :disabled="sendingCode || countdown > 0" @click="handleSendCode">
              {{ countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码' }}
            </VButton>
          </div>
        </template>

        <template v-else-if="activeMethod === 'password'">
          <label>用户名</label>
          <input v-model="username" maxlength="32" placeholder="请输入用户名" />
          <label>登录密码</label>
          <input v-model="password" type="password" placeholder="请输入登录密码" />
        </template>

        <template v-else>
          <label>邮箱</label>
          <input v-model="email" type="email" placeholder="请输入邮箱" />
          <label>邮箱验证码</label>
          <div class="code-row">
            <input v-model="emailCode" maxlength="6" placeholder="请输入 6 位验证码" />
            <VButton variant="secondary" :disabled="sendingEmailCode || emailCountdown > 0" @click="handleSendEmailCode">
              {{ emailCountdown > 0 ? `${emailCountdown}s` : sendingEmailCode ? '发送中...' : '获取验证码' }}
            </VButton>
          </div>
        </template>

        <label class="agreement">
          <input v-model="agreed" type="checkbox" />
          <span>我已阅读并同意《用户协议》和《隐私政策》</span>
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <VButton class="mt-6 w-full" variant="primary" :disabled="loading" @click="goLogin">
          {{ loading ? '登录中...' : activeMethod === 'password' ? '用户名登录 / 自动注册' : '登录 / 自动注册' }}
        </VButton>

        <div class="divider"><span />或使用快捷登录<span /></div>
        <VButton class="mt-3 w-full" variant="secondary" @click="router.push('/scan-login')">微信扫码登录</VButton>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  overflow: hidden;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 64px;
  align-items: center;
  padding: 56px clamp(24px, 6vw, 96px);
  background:
    linear-gradient(135deg, rgba(248, 251, 255, 0.88), rgba(231, 244, 255, 0.86)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1400' height='900' viewBox='0 0 1400 900'%3E%3Cdefs%3E%3CradialGradient id='a' cx='70%25' cy='35%25' r='45%25'%3E%3Cstop offset='0' stop-color='%236aa5ff' stop-opacity='.55'/%3E%3Cstop offset='.58' stop-color='%23bde2ff' stop-opacity='.18'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3ClinearGradient id='b' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23eaf4ff'/%3E%3Cstop offset='1' stop-color='%23f8fcff'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1400' height='900' fill='url(%23b)'/%3E%3Ccircle cx='1000' cy='300' r='330' fill='url(%23a)'/%3E%3Cpath d='M760 306c82-94 222-118 331-56 109 62 156 193 111 310-45 118-169 184-291 156-123-28-210-143-204-269' fill='none' stroke='%238dbdff' stroke-width='2' stroke-opacity='.35'/%3E%3Cpath d='M880 230l116-54 116 54v130c0 88-53 166-116 200-63-34-116-112-116-200V230z' fill='%231667ff' fill-opacity='.18' stroke='%232c78ff' stroke-width='7'/%3E%3Cpath d='M946 352v-43c0-36 22-64 50-64s50 28 50 64v43' fill='none' stroke='%230b58d9' stroke-width='22' stroke-linecap='round' stroke-opacity='.7'/%3E%3Crect x='920' y='338' width='152' height='112' rx='30' fill='%230b67ff' fill-opacity='.72'/%3E%3Ccircle cx='996' cy='391' r='15' fill='white' fill-opacity='.85'/%3E%3Cpath d='M996 404v28' stroke='white' stroke-width='12' stroke-linecap='round' opacity='.85'/%3E%3C/svg%3E");
  background-size: cover;
  background-position: center;
}

.hero h1 {
  margin: 10px 0 0;
  color: #0b1f4d;
  font-size: clamp(46px, 6vw, 78px);
  line-height: 1;
  font-weight: 900;
}

.eyebrow {
  color: #2866d8;
  font-weight: 700;
}

.subtitle {
  margin-top: 20px;
  color: #0b1f4d;
  font-size: 26px;
  font-weight: 800;
}

.security-line,
.muted {
  margin-top: 18px;
  color: #64748b;
}

.login-card {
  width: 100%;
  padding: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 64px rgba(11, 31, 77, 0.12);
}

.login-card h2 {
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
}

.method-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 6px;
  border-radius: 16px;
  background: #f1f5ff;
}

.method-tabs button {
  height: 42px;
  border: 1px solid transparent;
  border-radius: 14px;
  color: #3d5a7c;
  background: #e8f2ff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.method-tabs button.active {
  color: #1667ff;
  background: #fff;
  box-shadow: 0 8px 18px rgba(22, 103, 255, 0.12);
}

label {
  display: block;
  margin-top: 22px;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
}

input {
  margin-top: 8px;
  width: 100%;
  height: 44px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 0 14px;
  color: #0f172a;
  outline: none;
}

input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.code-row {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

.code-row input {
  margin-top: 0;
  min-width: 0;
}

.agreement {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #64748b;
  font-weight: 500;
}

.agreement input {
  width: 16px;
  height: 16px;
  margin: 0;
}

.error {
  margin-top: 14px;
  color: #dc2626;
  font-size: 14px;
}

.divider {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 28px;
  color: #94a3b8;
  font-size: 13px;
}

.divider span {
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

@media (max-width: 860px) {
  .login-page {
    grid-template-columns: 1fr;
    gap: 28px;
    padding: 32px 18px;
  }

  .hero h1 {
    font-size: 44px;
  }
}
</style>
