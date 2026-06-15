<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { bindEmailWithCode, getProfile, sendEmailLoginCode } from '@/utils/services';

const loading = ref(true);
const bindingEmail = ref(false);
const sendingEmailCode = ref(false);
const phone = ref('');
const email = ref('');
const emailInput = ref('');
const emailCode = ref('');
const emailCountdown = ref(0);
const wxBound = ref(false);
const mfaEnabled = ref(false);
const createdAt = ref('');
const lastLoginAt = ref('');
const message = ref('');
const error = ref('');

let emailCountdownTimer: ReturnType<typeof setInterval> | null = null;

onMounted(loadProfile);
onBeforeUnmount(() => {
  if (emailCountdownTimer) clearInterval(emailCountdownTimer);
});

async function loadProfile() {
  loading.value = true;
  error.value = '';
  try {
    const profile = await getProfile();
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
    emailInput.value = profile.email ?? '';
    wxBound.value = profile.wxBound ?? false;
    mfaEnabled.value = profile.mfaEnabled;
    createdAt.value = formatTime(profile.createdAt);
    lastLoginAt.value = profile.lastLoginAt ? formatTime(profile.lastLoginAt) : '暂无记录';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function startEmailCountdown() {
  emailCountdown.value = 60;
  if (emailCountdownTimer) clearInterval(emailCountdownTimer);
  emailCountdownTimer = setInterval(() => {
    emailCountdown.value -= 1;
    if (emailCountdown.value <= 0 && emailCountdownTimer) {
      clearInterval(emailCountdownTimer);
      emailCountdownTimer = null;
    }
  }, 1000);
}

async function handleSendEmailCode() {
  message.value = '';
  error.value = '';

  const value = emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    error.value = '请输入正确邮箱';
    return;
  }
  if (emailCountdown.value > 0) return;

  sendingEmailCode.value = true;
  try {
    await sendEmailLoginCode(value);
    startEmailCountdown();
    message.value = '邮箱验证码已发送';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败';
  } finally {
    sendingEmailCode.value = false;
  }
}

async function handleBindEmail() {
  message.value = '';
  error.value = '';

  const value = emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    error.value = '请输入正确邮箱';
    return;
  }
  if (!/^\d{6}$/.test(emailCode.value)) {
    error.value = '请输入 6 位验证码';
    return;
  }

  bindingEmail.value = true;
  try {
    const result = await bindEmailWithCode(value, emailCode.value);
    email.value = result.email;
    emailInput.value = result.email;
    emailCode.value = '';
    message.value = '邮箱已绑定';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '绑定失败';
  } finally {
    bindingEmail.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl rounded-xl bg-white p-8 ring-1 ring-slate-200">
    <h2 class="text-xl font-bold text-slate-900">个人资料</h2>
    <p class="mt-2 text-sm text-slate-500">管理账号联系方式。手机号用于登录与找回，邮箱用于通知与备用联系。</p>

    <div v-if="loading" class="mt-8 text-sm text-slate-500">加载中...</div>

    <template v-else>
      <div class="mt-8 space-y-5">
        <div class="block">
          <span class="text-sm font-medium text-slate-700">手机号</span>
          <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {{ phone || '未绑定，请在小程序中授权手机号绑定' }}
          </div>
        </div>

        <div class="block">
          <span class="text-sm font-medium text-slate-700">邮箱</span>
          <p class="mt-1 text-xs text-slate-500">
            当前：{{ email || '未绑定' }}。绑定后可用于邮箱验证码登录和安全通知。
          </p>
          <input
            v-model="emailInput"
            type="email"
            class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="请输入邮箱"
          />
          <div class="mt-3 flex gap-3">
            <input
              v-model="emailCode"
              maxlength="6"
              class="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="6 位验证码"
            />
            <VButton
              variant="secondary"
              :disabled="sendingEmailCode || emailCountdown > 0"
              @click="handleSendEmailCode"
            >
              {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
            </VButton>
          </div>
          <VButton class="mt-3" variant="primary" :disabled="bindingEmail" @click="handleBindEmail">
            {{ bindingEmail ? '绑定中...' : email ? '更换邮箱' : '绑定邮箱' }}
          </VButton>
        </div>

        <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>微信绑定：{{ wxBound ? '已绑定' : '未绑定' }}</p>
          <p class="mt-1">二次验证：{{ mfaEnabled ? '已启用' : '未启用' }}</p>
          <p class="mt-1">注册时间：{{ createdAt }}</p>
          <p class="mt-1">最近登录：{{ lastLoginAt }}</p>
          <p v-if="!wxBound" class="mt-2 text-xs text-slate-500">微信绑定请前往「安全中心」扫码绑定</p>
        </div>
      </div>

      <p v-if="message" class="mt-4 text-sm text-emerald-600">{{ message }}</p>
      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    </template>
  </div>
</template>
