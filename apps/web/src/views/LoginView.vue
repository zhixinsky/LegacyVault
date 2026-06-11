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
  persistAuthResult,
  register,
  sendLoginCode,
} from '@/utils/services';



const router = useRouter();

const phone = ref('');

const code = ref('');

const loading = ref(false);

const sendingCode = ref(false);

const countdown = ref(0);

const error = ref('');

const mfaPendingId = ref('');

const mfaCode = ref('');

const step = ref<'login' | 'mfa'>('login');

let countdownTimer: ReturnType<typeof setInterval> | null = null;



function startCountdown() {

  countdown.value = 60;

  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {

    countdown.value -= 1;

    if (countdown.value <= 0 && countdownTimer) {

      clearInterval(countdownTimer);

      countdownTimer = null;

    }

  }, 1000);

}



async function goRegister() {

  if (!/^1\d{10}$/.test(phone.value)) {

    error.value = '请输入正确的手机号';

    return;

  }

  error.value = '';

  vaultSession.setPendingPhone(phone.value);
  loading.value = true;
  try {
    const result = await register({ phone: phone.value });
    persistAuthResult(result);
    router.push('/create-vault-password');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败';
  } finally {
    loading.value = false;
  }

}



async function handleSendCode() {

  if (!/^1\d{10}$/.test(phone.value)) {

    error.value = '请输入正确的手机号';

    return;

  }

  if (countdown.value > 0) return;



  sendingCode.value = true;

  error.value = '';

  try {

    await sendLoginCode(phone.value);

    startCountdown();

  } catch (err) {

    error.value = err instanceof Error ? err.message : '验证码发送失败';

  } finally {

    sendingCode.value = false;

  }

}



async function goLogin() {

  if (!/^1\d{10}$/.test(phone.value)) {

    error.value = '请输入正确的手机号';

    return;

  }

  if (!/^\d{6}$/.test(code.value)) {

    error.value = '请输入 6 位验证码';

    return;

  }



  loading.value = true;

  error.value = '';

  try {

    const result = await loginWithCode(phone.value, code.value);

    if (isMfaRequired(result)) {
      mfaPendingId.value = result.pendingId;
      step.value = 'mfa';
      return;
    }

    if (!isAuthResult(result)) {
      error.value = '用户不存在，请先注册';
      return;
    }

    persistAuthResult(result);
    vaultSession.setPendingPhone(phone.value);
    router.push(!result.user.hasVault || !result.vaultKeyBundle ? '/create-vault-password' : '/unlock');

  } catch (err) {

    error.value = err instanceof Error ? err.message : '登录失败';

  } finally {
    loading.value = false;
  }
}

async function submitMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    error.value = '请输入 6 位二次验证码';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const result = await loginMfa(mfaPendingId.value, mfaCode.value);
    persistAuthResult(result);
    vaultSession.setPendingPhone(phone.value);
    router.push(!result.user.hasVault || !result.vaultKeyBundle ? '/create-vault-password' : '/unlock');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败';
  } finally {
    loading.value = false;
  }
}

</script>



<template>

  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">

    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">

      <h1 class="text-2xl font-bold text-slate-900">登录 VaultPass</h1>

      <p class="mt-2 text-sm text-slate-500">主密码仅在本地使用，不会发送到服务器</p>



      <template v-if="step === 'mfa'">
        <p class="mt-6 text-sm text-slate-600">检测到新设备登录，请输入二次验证码。</p>
        <label class="mt-4 block text-sm font-medium text-slate-700">二次验证码</label>
        <input
          v-model="mfaCode"
          type="text"
          maxlength="6"
          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="6 位 TOTP 验证码"
        />
        <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
        <VButton class="mt-6 w-full" variant="primary" :disabled="loading" @click="submitMfa">
          {{ loading ? '验证中...' : '完成登录' }}
        </VButton>
        <VButton class="mt-3 w-full" variant="secondary" @click="step = 'login'">返回</VButton>
      </template>

      <template v-else>
      <label class="mt-6 block text-sm font-medium text-slate-700">手机号</label>

      <input

        v-model="phone"

        type="tel"

        maxlength="11"

        class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"

        placeholder="请输入手机号"

      />



      <label class="mt-4 block text-sm font-medium text-slate-700">短信验证码</label>

      <div class="mt-2 flex gap-2">

        <input

          v-model="code"

          type="text"

          maxlength="6"

          class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"

          placeholder="6 位验证码"

        />

        <VButton

          variant="secondary"

          class="shrink-0"

          :disabled="sendingCode || countdown > 0"

          @click="handleSendCode"

        >

          {{ countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码' }}

        </VButton>

      </div>



      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>



      <VButton class="mt-6 w-full" variant="primary" :disabled="loading" @click="goLogin">

        {{ loading ? '登录中...' : '登录' }}

      </VButton>

      <VButton class="mt-3 w-full" variant="secondary" @click="router.push('/scan-login')">
        微信扫码登录
      </VButton>
      <VButton class="mt-3 w-full" variant="secondary" @click="goRegister">注册新账户</VButton>
      </template>

    </div>

  </div>

</template>

