<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
import { vaultSession } from '@/utils/api';
import {
  createScanLoginSession,
  getScanLoginStatus,
  isAuthResult,
  persistAuthResult,
  verifyScanLoginMfa,
} from '@/utils/services';

const router = useRouter();
const scanId = ref('');
const qrImage = ref('');
const expiresAt = ref('');
const mfaCode = ref('');
const status = ref<'loading' | 'pending' | 'mfa' | 'expired' | 'confirmed' | 'error'>('loading');
const error = ref('');
const mfaLoading = ref(false);

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void startScan();
});

onBeforeUnmount(() => {
  stopPolling();
});

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function finishLogin(result: Parameters<typeof persistAuthResult>[0]) {
  status.value = 'confirmed';
  stopPolling();
  persistAuthResult(result);
  if (result.user.phone) {
    vaultSession.setPendingPhone(result.user.phone);
  }
  router.push('/unlock');
}

async function startScan() {
  stopPolling();
  status.value = 'loading';
  error.value = '';
  mfaCode.value = '';

  try {
    const session = await createScanLoginSession();
    scanId.value = session.scanId;
    qrImage.value = session.qrImageBase64 ?? '';
    expiresAt.value = session.expiresAt;
    status.value = 'pending';
    startPolling();
  } catch (err) {
    status.value = 'error';
    error.value = err instanceof Error ? err.message : '创建扫码会话失败';
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    void pollStatus();
  }, 2000);
  void pollStatus();
}

async function pollStatus() {
  if (!scanId.value || status.value === 'confirmed' || status.value === 'expired' || status.value === 'mfa') {
    return;
  }

  try {
    const result = await getScanLoginStatus(scanId.value);

    if (result.status === 'expired') {
      status.value = 'expired';
      stopPolling();
      return;
    }

    if (result.status === 'mfa_required') {
      status.value = 'mfa';
      stopPolling();
      return;
    }

    if (result.status === 'confirmed' && isAuthResult(result)) {
      finishLogin(result);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '轮询失败';
  }
}

async function submitMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    error.value = '请输入 6 位二次验证码';
    return;
  }

  mfaLoading.value = true;
  error.value = '';
  try {
    const result = await verifyScanLoginMfa(scanId.value, mfaCode.value);
    if (isAuthResult(result)) {
      finishLogin(result);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败';
  } finally {
    mfaLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 class="text-2xl font-bold text-slate-900">微信扫码登录</h1>
      <p class="mt-2 text-sm text-slate-500">
        使用微信扫描下方小程序码，在手机上确认后即可登录网页端
      </p>

      <div v-if="status === 'loading'" class="mt-8 text-center text-sm text-slate-500">
        正在生成二维码...
      </div>

      <div v-else-if="status === 'pending'" class="mt-8 flex flex-col items-center">
        <img
          v-if="qrImage"
          :src="qrImage"
          alt="扫码登录"
          class="h-56 w-56 rounded-lg border border-slate-200"
        />
        <div v-else class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          <p>未能生成小程序码，请确认已配置 WX_APPID / WX_APP_SECRET</p>
          <p class="mt-2 break-all text-xs">会话 ID：{{ scanId }}</p>
          <p class="mt-2">请在小程序「扫码登录」页输入上述 ID 或重新扫码进入</p>
        </div>
        <p class="mt-4 text-sm text-slate-500">等待手机确认...</p>
        <p v-if="expiresAt" class="mt-1 text-xs text-slate-400">
          有效期至 {{ new Date(expiresAt).toLocaleTimeString() }}
        </p>
      </div>

      <div v-else-if="status === 'mfa'" class="mt-8 space-y-4">
        <p class="text-sm text-slate-600">手机已确认。检测到新设备登录，请输入二次验证码。</p>
        <input
          v-model="mfaCode"
          type="text"
          maxlength="6"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
          placeholder="6 位 TOTP 验证码"
        />
        <VButton class="w-full" variant="primary" :disabled="mfaLoading" @click="submitMfa">
          {{ mfaLoading ? '验证中...' : '完成登录' }}
        </VButton>
      </div>

      <div v-else-if="status === 'expired'" class="mt-8 text-center">
        <p class="text-sm text-amber-600">二维码已过期</p>
        <VButton class="mt-4" variant="primary" @click="startScan">刷新二维码</VButton>
      </div>

      <div v-else-if="status === 'error'" class="mt-8 text-center">
        <p class="text-sm text-red-600">{{ error }}</p>
        <VButton class="mt-4" variant="primary" @click="startScan">重试</VButton>
      </div>

      <p v-if="error && status !== 'error'" class="mt-4 text-sm text-red-600">{{ error }}</p>

      <VButton class="mt-6 w-full" variant="secondary" @click="router.push('/login')">
        返回短信登录
      </VButton>
    </div>
  </div>
</template>
