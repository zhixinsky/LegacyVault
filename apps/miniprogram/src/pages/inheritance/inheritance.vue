<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { getInheritanceStageLabel, getInheritanceStatusLabel } from '@vaultpass/types';
import {
  disableInheritanceRule,
  getActiveInheritanceEvent,
  getInheritanceRule,
  listInheritanceEvents,
  respondInheritanceEvent,
  saveInheritanceRule,
  type InheritanceEventItem,
} from '@/utils/services';

const inactiveYears = ref(3);
const gracePeriodMonths = ref(12);
const requireMultiContact = ref(false);
const reminderFrequency = ref('quarterly');
const activeEvent = ref<InheritanceEventItem | null>(null);
const eventHistory = ref<InheritanceEventItem[]>([]);
const loading = ref(false);
const saving = ref(false);

const frequencyOptions = [
  { label: '每季度提醒', value: 'quarterly' },
  { label: '每两月提醒', value: 'bimonthly' },
  { label: '每月提醒', value: 'monthly' },
];
const frequencyIndex = ref(0);

onShow(loadRule);

async function loadRule() {
  loading.value = true;
  try {
    const [rule, event, history] = await Promise.all([
      getInheritanceRule(),
      getActiveInheritanceEvent(),
      listInheritanceEvents(),
    ]);
    activeEvent.value = event;
    eventHistory.value = history.items;

    if (!rule) return;

    inactiveYears.value = rule.inactiveYears;
    gracePeriodMonths.value = rule.gracePeriodMonths;
    requireMultiContact.value = rule.requireMultiContact;
    reminderFrequency.value = rule.reminderFrequency;

    const index = frequencyOptions.findIndex((item) => item.value === rule.reminderFrequency);
    frequencyIndex.value = index >= 0 ? index : 0;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function handleDisable() {
  try {
    await disableInheritanceRule();
    uni.showToast({ title: '数字遗产已关闭', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '关闭失败',
      icon: 'none',
    });
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await saveInheritanceRule({
      inactiveYears: inactiveYears.value,
      gracePeriodMonths: gracePeriodMonths.value,
      requireMultiContact: requireMultiContact.value,
      reminderFrequency: frequencyOptions[frequencyIndex.value]?.value ?? 'quarterly',
      status: 'active',
    });
    uni.showToast({ title: '规则已保存', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '保存失败',
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

function onYearsChange(event: { detail: { value: string | number } }) {
  inactiveYears.value = Number(event.detail.value);
}

function onGraceChange(event: { detail: { value: string | number } }) {
  gracePeriodMonths.value = Number(event.detail.value);
}

function onFrequencyChange(event: { detail: { value: string | number } }) {
  frequencyIndex.value = Number(event.detail.value);
}

function onMultiContactChange(event: unknown) {
  const detail = (event as { detail?: { value?: boolean } }).detail;
  requireMultiContact.value = Boolean(detail?.value);
}

async function handleRespond(action: 'cancel' | 'pause' | 'allow_takeover') {
  if (!activeEvent.value) return;

  try {
    await respondInheritanceEvent(activeEvent.value.id, action);
    activeEvent.value = null;
    const messages = {
      cancel: '已取消交接流程',
      pause: '已暂停交接 1 年',
      allow_takeover: '已允许安全联系人接管',
    };
    uni.showToast({ title: messages[action], icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '操作失败',
      icon: 'none',
    });
  }
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">数字遗产规则</text>
      <text class="subtitle">长期未登录时将按规则提醒并进入交接流程</text>

      <view v-if="activeEvent" class="alert-box">
        <text class="alert-title">
          进行中的交接流程：{{ getInheritanceStageLabel(activeEvent.currentStage) }}
          （{{ getInheritanceStatusLabel(activeEvent.status) }}）
        </text>
        <view class="alert-actions">
          <button class="btn btn-secondary" @tap="handleRespond('cancel')">我还在使用，取消流程</button>
          <button class="btn btn-secondary" @tap="handleRespond('pause')">暂停 1 年</button>
          <button class="btn btn-secondary" @tap="handleRespond('allow_takeover')">立即允许接管</button>
        </view>
      </view>

      <text class="field-label">未登录年限：{{ inactiveYears }} 年</text>
      <slider :value="inactiveYears" min="1" max="5" step="1" show-value @change="onYearsChange" />

      <text class="field-label">验证期：{{ gracePeriodMonths }} 个月</text>
      <slider
        :value="gracePeriodMonths"
        min="3"
        max="24"
        step="1"
        show-value
        @change="onGraceChange"
      />

      <text class="field-label">提醒频率</text>
      <picker
        :range="frequencyOptions"
        range-key="label"
        :value="frequencyIndex"
        @change="onFrequencyChange"
      >
        <view class="picker-value">{{ frequencyOptions[frequencyIndex]?.label }}</view>
      </picker>

      <view class="switch-row">
        <text>需要多个联系人共同确认</text>
        <switch :checked="requireMultiContact" @change="onMultiContactChange" />
      </view>

      <button class="btn btn-primary" :loading="saving" @tap="handleSave">保存规则</button>
      <button class="btn btn-secondary" @tap="handleDisable">关闭数字遗产</button>
      <text v-if="loading" class="hint">正在加载已有规则...</text>

      <view v-if="eventHistory.length" class="history-box">
        <text class="field-label">交接事件历史</text>
        <view v-for="item in eventHistory" :key="item.id" class="history-item">
          <text class="history-title">
            {{ getInheritanceStageLabel(item.currentStage) }} ·
            {{ getInheritanceStatusLabel(item.status) }}
          </text>
          <text class="hint">{{ new Date(item.createdAt).toLocaleString() }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28rpx;
  font-size: 26rpx;
}

.alert-box {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #fffbeb;
  border: 1rpx solid #fde68a;
}

.alert-title {
  display: block;
  font-size: 26rpx;
  color: #92400e;
  font-weight: 600;
}

.alert-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.btn-secondary {
  background: #fff;
  color: #334155;
  border: 1rpx solid #cbd5e1;
}

.history-box {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #e2e8f0;
}

.history-item {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}

.history-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
}
</style>
