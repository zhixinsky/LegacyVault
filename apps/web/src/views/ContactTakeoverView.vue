<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { VButton } from '@vaultpass/ui';
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

const route = useRoute();
const router = useRouter();
const step = ref<'token' | 'otp' | 'challenges'>('token');
const token = ref(String(route.query.token ?? ''));
const sessionId = ref('');
const otpChannel = ref<'sms' | 'email'>('sms');
const otpTarget = ref('');
const otpCode = ref('');
const challenges = ref<Array<{ id: string; questionLabel: string; answer: string }>>([]);
const error = ref('');
const loading = ref(false);

const primaryAnswer = computed(() => challenges.value[0]?.answer ?? '');

async function handleStart() {
  loading.value = true;
  error.value = '';
  try {
    const result = await startContactTakeover(token.value.trim());
    sessionId.value = result.sessionId;
    step.value = 'otp';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '令牌无效';
  } finally {
    loading.value = false;
  }
}

async function handleSendOtp() {
  loading.value = true;
  error.value = '';
  try {
    await sendContactTakeoverOtp(sessionId.value, {
      channel: otpChannel.value,
      target: otpTarget.value.trim(),
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '发送失败';
  } finally {
    loading.value = false;
  }
}

async function handleVerifyOtp() {
  loading.value = true;
  error.value = '';
  try {
    await verifyContactTakeoverOtp(sessionId.value, otpCode.value.trim());
    const result = await listContactTakeoverChallenges(sessionId.value);
    challenges.value = result.items.map((item) => ({
      id: item.id,
      questionLabel: item.questionLabel,
      answer: '',
    }));
    step.value = 'challenges';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败';
  } finally {
    loading.value = false;
  }
}

async function handleVerifyChallenges() {
  loading.value = true;
  error.value = '';
  try {
    await verifyContactTakeoverChallenges(
      sessionId.value,
      challenges.value.map((item) => ({ challengeId: item.id, answer: item.answer })),
    );
    const result = await completeContactTakeover(sessionId.value);
    if (result.pendingMultiContact) {
      error.value = `已验证通过，尚需 ${result.requiredCount} 位联系人共同确认（当前 ${result.completedCount}/${result.requiredCount}）。全部完成后请再次点击提交。`;
      return;
    }
    if (!result.encryptedVaultKeyForContact) {
      throw new Error('未获取到保险箱密钥');
    }
    const vaultKey = await decryptContactVaultKey(
      result.encryptedVaultKeyForContact,
      primaryAnswer.value,
    );
    contactVaultSession.setSession(sessionId.value, vaultKey);
    router.push({ path: '/contact-vault', query: { sessionId: sessionId.value } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : '验证失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
    <div class="w-full max-w-lg rounded-xl bg-white p-8 ring-1 ring-slate-200">
      <h1 class="text-2xl font-bold text-slate-900">安全联系人接管验证</h1>
      <p class="mt-2 text-sm text-slate-500">请使用通知中的接管令牌完成身份验证</p>

      <div v-if="step === 'token'" class="mt-6 space-y-4">
        <input
          v-model="token"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="接管令牌"
        />
        <VButton variant="primary" :disabled="loading" @click="handleStart">开始验证</VButton>
      </div>

      <div v-else-if="step === 'otp'" class="mt-6 space-y-4">
        <select v-model="otpChannel" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="sms">短信验证</option>
          <option value="email">邮箱验证</option>
        </select>
        <input
          v-model="otpTarget"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="手机号或邮箱"
        />
        <VButton variant="secondary" :disabled="loading" @click="handleSendOtp">发送验证码</VButton>
        <input
          v-model="otpCode"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="6 位验证码"
        />
        <VButton variant="primary" :disabled="loading" @click="handleVerifyOtp">验证并继续</VButton>
      </div>

      <div v-else-if="step === 'challenges'" class="mt-6 space-y-4">
        <div v-for="item in challenges" :key="item.id">
          <label class="text-sm text-slate-600">{{ item.questionLabel }}</label>
          <input
            v-model="item.answer"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="请输入答案"
          />
        </div>
        <VButton variant="primary" :disabled="loading" @click="handleVerifyChallenges">提交验证</VButton>
      </div>

      <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
    </div>
  </div>
</template>
