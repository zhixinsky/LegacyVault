<script setup lang="ts">

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { getNotificationChannelLabel, getNotificationTypeLabel } from '@vaultpass/types';
import { VButton } from '@vaultpass/ui';

import { vaultSession } from '@/utils/api';

import { buildRecoveryKeyPayload } from '@/utils/crypto-flow';

import {

  createWxBindScanSession,
  disableMfa,
  enableMfa,
  getProfile,
  getWxBindScanStatus,
  listLoginDevices,
  listNotifications,
  revokeLoginDevice,
  setupMfa,
  setupRecoveryKey,
  unbindWechat,
  type LoginDeviceItem,
  type NotificationLogItem,
} from '@/utils/services';



const mfaEnabled = ref(false);

const recoveryConfigured = ref(false);

const recoveryHint = ref('');

const setupSecret = ref('');

const otpauthUrl = ref('');

const verifyCode = ref('');

const disableCode = ref('');

const recoveryPassphrase = ref('');

const recoveryConfirm = ref('');

const recoveryHintInput = ref('');

const recoveryMfaCode = ref('');

const devices = ref<LoginDeviceItem[]>([]);

const wxBound = ref(false);

const message = ref('');

const error = ref('');

const loading = ref(false);
const bindId = ref('');
const bindQrImage = ref('');
const bindStatus = ref<'idle' | 'pending' | 'confirmed' | 'expired' | 'error'>('idle');
const bindLoading = ref(false);
const notifications = ref<NotificationLogItem[]>([]);

let bindPollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(loadAll);

onBeforeUnmount(stopBindPolling);



async function loadAll() {

  try {

    const [profile, deviceResult, notificationResult] = await Promise.all([
      getProfile(),
      listLoginDevices(),
      listNotifications(),
    ]);

    mfaEnabled.value = profile.mfaEnabled;

    recoveryConfigured.value = profile.recoveryKeyConfigured ?? false;

    recoveryHint.value = profile.recoveryKeyHint ?? '';

    wxBound.value = profile.wxBound ?? false;

    devices.value = deviceResult.items;
    notifications.value = notificationResult.items;

    if (profile.encryptedVaultKeyByRecovery) {

      vaultSession.setRecoveryBundle(profile.encryptedVaultKeyByRecovery);

    }

  } catch (err) {

    error.value = err instanceof Error ? err.message : '加载失败';

  }

}



async function handleSetupMfa() {

  loading.value = true;

  error.value = '';

  try {

    const result = await setupMfa();

    setupSecret.value = result.secret;

    otpauthUrl.value = result.otpauthUrl;

    message.value = '请使用验证器 App 扫描二维码或手动输入密钥';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '初始化失败';

  } finally {

    loading.value = false;

  }

}



async function handleEnableMfa() {

  if (!setupSecret.value || !verifyCode.value) {

    error.value = '请先完成设置并输入验证码';

    return;

  }

  try {

    await enableMfa(setupSecret.value, verifyCode.value);

    mfaEnabled.value = true;

    setupSecret.value = '';

    message.value = '二次验证已启用';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '启用失败';

  }

}



async function handleDisableMfa() {

  try {

    await disableMfa(disableCode.value);

    mfaEnabled.value = false;

    message.value = '二次验证已关闭';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '关闭失败';

  }

}



async function handleSetupRecovery() {

  if (!recoveryPassphrase.value || recoveryPassphrase.value !== recoveryConfirm.value) {

    error.value = '两次输入的恢复密钥不一致';

    return;

  }

  loading.value = true;

  error.value = '';

  try {

    const encryptedVaultKeyByRecovery = await buildRecoveryKeyPayload(recoveryPassphrase.value);

    await setupRecoveryKey(

      {

        encryptedVaultKeyByRecovery,

        recoveryKeyHint: recoveryHintInput.value || undefined,

      },

      recoveryMfaCode.value || undefined,

    );

    vaultSession.setRecoveryBundle(encryptedVaultKeyByRecovery);

    recoveryConfigured.value = true;

    recoveryHint.value = recoveryHintInput.value;

    recoveryPassphrase.value = '';

    recoveryConfirm.value = '';

    message.value = '恢复密钥已保存，请妥善保管';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '设置失败';

  } finally {

    loading.value = false;

  }

}



function stopBindPolling() {
  if (bindPollTimer) {
    clearInterval(bindPollTimer);
    bindPollTimer = null;
  }
}

async function startWxBindScan() {
  stopBindPolling();
  bindLoading.value = true;
  bindStatus.value = 'pending';
  error.value = '';
  try {
    const session = await createWxBindScanSession();
    bindId.value = session.bindId;
    bindQrImage.value = session.qrImageBase64 ?? '';
    bindPollTimer = setInterval(() => {
      void pollWxBindStatus();
    }, 2000);
    void pollWxBindStatus();
  } catch (err) {
    bindStatus.value = 'error';
    error.value = err instanceof Error ? err.message : '生成绑定二维码失败';
  } finally {
    bindLoading.value = false;
  }
}

async function pollWxBindStatus() {
  if (!bindId.value || bindStatus.value === 'confirmed' || bindStatus.value === 'expired') {
    return;
  }
  try {
    const result = await getWxBindScanStatus(bindId.value);
    if (result.status === 'expired') {
      bindStatus.value = 'expired';
      stopBindPolling();
      return;
    }
    if (result.status === 'confirmed') {
      bindStatus.value = 'confirmed';
      wxBound.value = true;
      message.value = '微信绑定成功';
      stopBindPolling();
    }
  } catch {
    // ignore transient poll errors
  }
}

async function handleUnbindWechat() {
  if (!confirm('确定解绑微信？解绑后将无法使用微信快捷登录与扫码确认')) return;
  try {
    await unbindWechat();
    wxBound.value = false;
    message.value = '微信已解绑';
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解绑失败';
  }
}

async function handleRevokeDevice(id: string) {

  if (!confirm('确定移除此设备的登录记录？')) return;

  try {

    await revokeLoginDevice(id);

    await loadAll();

    message.value = '设备已移除';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '操作失败';

  }

}

</script>



<template>

  <div class="mx-auto max-w-2xl space-y-6">

    <section class="rounded-xl bg-white p-8 ring-1 ring-slate-200">

      <h2 class="text-xl font-bold text-slate-900">二次验证 (TOTP)</h2>

      <p class="mt-2 text-sm text-slate-500">高风险操作需要验证码</p>



      <div v-if="!mfaEnabled" class="mt-6 space-y-4">

        <VButton variant="primary" :disabled="loading" @click="handleSetupMfa">生成二次验证密钥</VButton>

        <p v-if="setupSecret" class="break-all text-xs text-slate-500">密钥：{{ setupSecret }}</p>

        <input v-model="verifyCode" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="输入 6 位验证码以启用" />

        <VButton variant="primary" @click="handleEnableMfa">确认启用</VButton>

      </div>

      <div v-else class="mt-6 space-y-4">

        <p class="text-sm text-emerald-600">二次验证已启用</p>

        <input v-model="disableCode" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="输入验证码以关闭" />

        <VButton variant="secondary" @click="handleDisableMfa">关闭二次验证</VButton>

      </div>

    </section>



    <section class="rounded-xl bg-white p-8 ring-1 ring-slate-200">

      <h2 class="text-xl font-bold text-slate-900">恢复密钥</h2>

      <p class="mt-2 text-sm text-slate-500">忘记主密码时，可用恢复密钥解锁保险箱（请离线妥善保存）</p>

      <p v-if="recoveryConfigured" class="mt-2 text-sm text-emerald-600">

        已配置{{ recoveryHint ? `，提示：${recoveryHint}` : '' }}

      </p>

      <div v-else class="mt-4 space-y-3">

        <input v-model="recoveryPassphrase" type="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="设置恢复密钥" />

        <input v-model="recoveryConfirm" type="password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="确认恢复密钥" />

        <input v-model="recoveryHintInput" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="提示语（可选，帮助记忆）" />

        <input v-if="mfaEnabled" v-model="recoveryMfaCode" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="二次验证码" />

        <VButton variant="primary" :disabled="loading" @click="handleSetupRecovery">保存恢复密钥</VButton>

      </div>

    </section>



    <section class="rounded-xl bg-white p-8 ring-1 ring-slate-200">
      <h2 class="text-xl font-bold text-slate-900">微信绑定</h2>
      <p class="mt-2 text-sm text-slate-500">绑定后可使用微信快捷登录，并在小程序中确认 PC 扫码登录</p>

      <div v-if="wxBound" class="mt-4 space-y-3">
        <p class="text-sm text-emerald-600">已绑定微信</p>
        <VButton variant="secondary" @click="handleUnbindWechat">解绑微信</VButton>
      </div>

      <div v-else class="mt-4 space-y-4">
        <p class="text-sm text-amber-600">未绑定微信</p>
        <VButton variant="primary" :disabled="bindLoading" @click="startWxBindScan">
          {{ bindLoading ? '生成中...' : '生成绑定二维码' }}
        </VButton>
        <img
          v-if="bindQrImage && bindStatus === 'pending'"
          :src="bindQrImage"
          alt="微信绑定二维码"
          class="mx-auto w-56 rounded-lg border border-slate-200"
        />
        <p v-if="bindStatus === 'pending'" class="text-center text-sm text-slate-500">
          请使用微信扫描小程序码，在手机上确认绑定
        </p>
        <p v-if="bindStatus === 'expired'" class="text-sm text-amber-600">
          二维码已过期，请重新生成
        </p>
        <p class="text-xs text-slate-400">也可在小程序「安全中心」中直接绑定</p>
      </div>
    </section>

    <section class="rounded-xl bg-white p-8 ring-1 ring-slate-200">
      <h2 class="text-xl font-bold text-slate-900">安全通知</h2>
      <p class="mt-2 text-sm text-slate-500">新设备登录、异地 IP 等告警将发送至手机或邮箱</p>
      <ul v-if="notifications.length" class="mt-4 divide-y divide-slate-100 text-sm">
        <li v-for="item in notifications" :key="item.id" class="py-3">
          <p class="font-medium">{{ getNotificationTypeLabel(item.notificationType) }}</p>
          <p class="text-slate-500">
            {{ getNotificationChannelLabel(item.channel) }} · {{ item.status }} ·
            {{ new Date(item.createdAt).toLocaleString() }}
          </p>
        </li>
      </ul>
      <p v-else class="mt-4 text-sm text-slate-400">暂无通知记录</p>
    </section>



    <section class="rounded-xl bg-white p-8 ring-1 ring-slate-200">

      <h2 class="text-xl font-bold text-slate-900">登录设备</h2>

      <ul v-if="devices.length" class="mt-4 divide-y divide-slate-100">

        <li v-for="device in devices" :key="device.id" class="flex items-center justify-between py-3 text-sm">

          <div>

            <p class="font-medium">{{ device.deviceName || '未知设备' }}</p>

            <p class="text-slate-500">{{ device.ip || '-' }} · {{ new Date(device.lastActiveAt).toLocaleString() }}</p>

          </div>

          <button class="rounded-xl bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-100" @click="handleRevokeDevice(device.id)">移除</button>

        </li>

      </ul>

      <p v-else class="mt-4 text-sm text-slate-400">暂无设备记录</p>

    </section>



    <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

  </div>

</template>

