<script setup lang="ts">

import { onShow } from '@dcloudio/uni-app';

import { ref } from 'vue';

import { decryptVaultPayload, decryptVaultTitle } from '@/utils/crypto-flow';

import { deleteVaultItem, getProfile, listVaultItems, revealVaultPassword, type VaultItem } from '@/utils/services';



const items = ref<Array<{ id: string; title: string; username: string; encryptedPayload: string }>>([]);

const mfaEnabled = ref(false);

const revealMfaCode = ref('');

const revealTarget = ref<{ id: string; title: string; encryptedPayload: string } | null>(null);

const revealedPassword = ref('');

const loading = ref(false);



onShow(async () => {

  try {

    const profile = await getProfile();

    mfaEnabled.value = profile.mfaEnabled;

  } catch {

    // ignore

  }

  await loadItems();

});



async function loadItems() {

  loading.value = true;

  try {

    const passwordResult = await listVaultItems('password');

    const rows = [];

    for (const item of passwordResult.items) {

      rows.push(await parseItem(item));

    }

    items.value = rows;

  } catch (error) {

    uni.showToast({ title: error instanceof Error ? error.message : '加载失败', icon: 'none' });

  } finally {

    loading.value = false;

  }

}



async function parseItem(item: VaultItem) {

  try {

    const title = await decryptVaultTitle(item.titleCiphertext);

    const payload = await decryptVaultPayload<{ username?: string; address?: string; provider?: string; host?: string }>(item.encryptedPayload);

    return {

      id: item.id,

      title,

      username: payload.username ?? payload.address ?? payload.host ?? payload.provider ?? '-',

      encryptedPayload: item.encryptedPayload,

    };

  } catch {

    return { id: item.id, title: '解密失败', username: '-', encryptedPayload: item.encryptedPayload };

  }

}



function openReveal(item: (typeof items.value)[number]) {

  revealTarget.value = item;

  revealedPassword.value = '';

  revealMfaCode.value = '';

}



async function handleReveal() {

  if (!revealTarget.value) return;

  try {

    await revealVaultPassword(revealTarget.value.id, revealMfaCode.value || undefined);

    const payload = await decryptVaultPayload<{ password?: string }>(revealTarget.value.encryptedPayload);

    revealedPassword.value = payload.password ?? '（未设置）';

  } catch (error) {

    uni.showToast({ title: error instanceof Error ? error.message : '查看失败', icon: 'none' });

  }

}



function closeReveal() {

  revealTarget.value = null;

}



function goEdit(id: string) {
  uni.navigateTo({ url: `/pages/password-create/password-create?id=${id}` });
}

async function handleDelete(id: string) {

  uni.showModal({

    title: '删除确认',

    content: '将移入回收站',

    success: async (res) => {

      if (!res.confirm) return;

      await deleteVaultItem(id);

      await loadItems();

    },

  });

}

</script>



<template>

  <view class="container">

    <view class="card">

      <text class="title">账号密码</text>

      <view v-if="loading" class="hint">加载中...</view>

      <view v-else-if="items.length === 0" class="hint">暂无记录</view>

      <view v-else>

        <view v-for="item in items" :key="item.id" class="list-item">

          <text class="item-title">{{ item.title }}</text>

          <text class="hint">{{ item.username }}</text>

          <view class="actions">

            <button class="btn btn-secondary btn-small" @tap="openReveal(item)">查看密码</button>

            <button class="btn btn-secondary btn-small" @tap="goEdit(item.id)">编辑</button>

            <button class="btn btn-secondary btn-small" @tap="handleDelete(item.id)">删除</button>

          </view>

        </view>

      </view>

    </view>



    <view v-if="revealTarget" class="modal-mask">

      <view class="modal card">

        <text class="title">查看密码 · {{ revealTarget.title }}</text>

        <input v-if="!revealedPassword" v-model="revealMfaCode" class="input" :placeholder="mfaEnabled ? '输入验证码' : '未启用 MFA 可留空'" />

        <text v-if="revealedPassword" class="password">{{ revealedPassword }}</text>

        <view class="actions">

          <button v-if="!revealedPassword" class="btn btn-primary" @tap="handleReveal">确认</button>

          <button class="btn btn-secondary" @tap="closeReveal">关闭</button>

        </view>

      </view>

    </view>

  </view>

</template>



<style scoped lang="scss">

@import '@/uni.scss';



.item-title { display: block; font-weight: 600; margin-bottom: 8rpx; }

.actions { display: flex; gap: 16rpx; margin-top: 16rpx; }

.btn-small { margin: 0; font-size: 24rpx; line-height: 56rpx; height: 56rpx; padding: 0 24rpx; }

.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; padding: 32rpx; }

.modal { width: 100%; }

.input { border: 1rpx solid #cbd5e1; border-radius: 12rpx; padding: 16rpx; margin: 16rpx 0; }

.password { display: block; margin: 16rpx 0; padding: 16rpx; background: #f8fafc; word-break: break-all; }

</style>

