<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { getProfile, updateProfile } from '@/utils/services';

const loading = ref(true);
const saving = ref(false);
const phone = ref('');
const email = ref('');
const wxBound = ref(false);
const mfaEnabled = ref(false);
const createdAt = ref('');
const lastLoginAt = ref('');
const message = ref('');
const error = ref('');

onMounted(loadProfile);

async function loadProfile() {
  loading.value = true;
  error.value = '';
  try {
    const profile = await getProfile();
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
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

async function handleSave() {
  message.value = '';
  error.value = '';

  const payload: { phone?: string; email?: string } = {};
  if (phone.value.trim()) {
    if (!/^1\d{10}$/.test(phone.value.trim())) {
      error.value = '手机号格式不正确';
      return;
    }
    payload.phone = phone.value.trim();
  }
  if (email.value.trim()) {
    payload.email = email.value.trim();
  }

  if (!payload.phone && !payload.email) {
    error.value = '请至少填写手机号或邮箱';
    return;
  }

  saving.value = true;
  try {
    const profile = await updateProfile(payload);
    phone.value = profile.phone ?? '';
    email.value = profile.email ?? '';
    message.value = '资料已保存';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败';
  } finally {
    saving.value = false;
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
        <label class="block">
          <span class="text-sm font-medium text-slate-700">手机号</span>
          <input
            v-model="phone"
            type="tel"
            maxlength="11"
            class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="11 位手机号"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-slate-700">邮箱</span>
          <input
            v-model="email"
            type="email"
            class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="可选"
          />
        </label>

        <div class="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>微信绑定：{{ wxBound ? '已绑定' : '未绑定' }}</p>
          <p class="mt-1">二次验证：{{ mfaEnabled ? '已启用' : '未启用' }}</p>
          <p class="mt-1">注册时间：{{ createdAt }}</p>
          <p class="mt-1">最近登录：{{ lastLoginAt }}</p>
          <p v-if="!wxBound" class="mt-2 text-xs text-slate-500">微信绑定请前往「安全中心」扫码绑定</p>
        </div>
      </div>

      <VButton class="mt-8" variant="primary" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存资料' }}
      </VButton>

      <p v-if="message" class="mt-4 text-sm text-emerald-600">{{ message }}</p>
      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    </template>
  </div>
</template>
