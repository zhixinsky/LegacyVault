<script setup lang="ts">

import { onMounted, ref } from 'vue';

import { getInheritanceStageLabel, getInheritanceStatusLabel } from '@vaultpass/types';
import { VButton } from '@vaultpass/ui';

import {

  disableInheritanceRule,

  getActiveInheritanceEvent,

  getInheritanceRule,

  getProfile,

  listInheritanceEvents,

  respondInheritanceEvent,

  saveInheritanceRule,

  type InheritanceEventItem,

} from '@/utils/services';



const inactiveYears = ref(3);

const gracePeriodMonths = ref(12);

const requireMultiContact = ref(false);

const reminderFrequency = ref('quarterly');

const ruleEnabled = ref(true);

const activeEvent = ref<InheritanceEventItem | null>(null);
const eventHistory = ref<InheritanceEventItem[]>([]);

const mfaEnabled = ref(false);

const mfaCode = ref('');

const loading = ref(true);

const saving = ref(false);

const message = ref('');

const error = ref('');



const frequencyOptions = [

  { label: '每季度提醒', value: 'quarterly' },

  { label: '每两月提醒', value: 'bimonthly' },

  { label: '每月提醒', value: 'monthly' },

];



onMounted(async () => {

  try {

    const [rule, event, profile, history] = await Promise.all([

      getInheritanceRule(),

      getActiveInheritanceEvent(),

      getProfile(),

      listInheritanceEvents(),

    ]);

    mfaEnabled.value = profile.mfaEnabled;

    activeEvent.value = event;
    eventHistory.value = history.items;

    if (rule) {

      inactiveYears.value = rule.inactiveYears;

      gracePeriodMonths.value = rule.gracePeriodMonths;

      requireMultiContact.value = rule.requireMultiContact;

      reminderFrequency.value = rule.reminderFrequency;

      ruleEnabled.value = rule.status === 'active';

    }

  } catch (err) {

    error.value = err instanceof Error ? err.message : '加载失败';

  } finally {

    loading.value = false;

  }

});



async function handleRespond(action: 'cancel' | 'pause' | 'allow_takeover') {

  if (!activeEvent.value) return;

  try {

    await respondInheritanceEvent(activeEvent.value.id, action);

    activeEvent.value = null;

    message.value =

      action === 'cancel'

        ? '已取消交接流程'

        : action === 'pause'

          ? '已暂停交接 1 年'

          : '已允许安全联系人接管';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '操作失败';

  }

}



async function handleSave() {

  saving.value = true;

  message.value = '';

  error.value = '';

  try {

    await saveInheritanceRule(

      {

        inactiveYears: inactiveYears.value,

        gracePeriodMonths: gracePeriodMonths.value,

        requireMultiContact: requireMultiContact.value,

        reminderFrequency: reminderFrequency.value,

        status: 'active',

      },

      mfaCode.value || undefined,

    );

    ruleEnabled.value = true;

    message.value = '规则已保存';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '保存失败';

  } finally {

    saving.value = false;

  }

}



async function handleDisable() {

  try {

    await disableInheritanceRule(mfaCode.value || undefined);

    ruleEnabled.value = false;

    message.value = '数字遗产功能已关闭';

  } catch (err) {

    error.value = err instanceof Error ? err.message : '关闭失败';

  }

}

</script>



<template>

  <div class="mx-auto max-w-2xl rounded-xl bg-white p-8 ring-1 ring-slate-200">

    <h2 class="text-xl font-bold text-slate-900">数字遗产规则</h2>

    <p class="mt-2 text-sm text-slate-500">长期未登录时将按规则进入提醒与交接流程</p>



    <div

      v-if="activeEvent"

      class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"

    >

      <p class="font-medium">
        进行中的交接流程：{{ getInheritanceStageLabel(activeEvent.currentStage) }}
        （{{ getInheritanceStatusLabel(activeEvent.status) }}）
      </p>

      <div class="mt-3 flex flex-wrap gap-3">

        <VButton variant="secondary" @click="handleRespond('cancel')">我还在使用，取消流程</VButton>

        <VButton variant="secondary" @click="handleRespond('pause')">暂停 1 年</VButton>

        <VButton variant="secondary" @click="handleRespond('allow_takeover')">立即允许接管</VButton>

      </div>

    </div>



    <p v-if="!ruleEnabled" class="mt-4 text-sm text-amber-600">数字遗产功能当前已关闭</p>



    <div v-if="loading" class="mt-8 text-center text-slate-400">加载中...</div>

    <div v-else class="mt-6 space-y-6">

      <label class="block">

        <span class="text-sm text-slate-600">未登录年限：{{ inactiveYears }} 年</span>

        <input v-model.number="inactiveYears" type="range" min="1" max="5" class="mt-2 w-full" />

      </label>



      <label class="block">

        <span class="text-sm text-slate-600">验证期：{{ gracePeriodMonths }} 个月</span>

        <input v-model.number="gracePeriodMonths" type="range" min="3" max="24" class="mt-2 w-full" />

      </label>



      <label class="block">

        <span class="text-sm text-slate-600">提醒频率</span>

        <select v-model="reminderFrequency" class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2">

          <option v-for="item in frequencyOptions" :key="item.value" :value="item.value">

            {{ item.label }}

          </option>

        </select>

      </label>



      <label class="flex items-center gap-3 text-sm text-slate-600">

        <input v-model="requireMultiContact" type="checkbox" />

        需要多个安全联系人共同确认

      </label>



      <div v-if="mfaEnabled">

        <label class="text-sm text-slate-600">二次验证码（修改规则时必填）</label>

        <input

          v-model="mfaCode"

          class="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"

          placeholder="6 位验证码"

        />

      </div>



      <div class="flex flex-wrap gap-3">

        <VButton variant="primary" :disabled="saving" @click="handleSave">

          {{ saving ? '保存中...' : '保存规则' }}

        </VButton>

        <VButton variant="secondary" @click="handleDisable">关闭数字遗产</VButton>

      </div>



      <p v-if="message" class="text-sm text-emerald-600">{{ message }}</p>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

    </div>

    <section v-if="eventHistory.length" class="mt-8 border-t border-slate-200 pt-6">
      <h3 class="font-semibold text-slate-900">交接事件历史</h3>
      <ul class="mt-4 divide-y divide-slate-100 text-sm">
        <li v-for="item in eventHistory" :key="item.id" class="py-3">
          <p class="font-medium text-slate-800">
            {{ getInheritanceStageLabel(item.currentStage) }}
            <span class="text-slate-500">· {{ getInheritanceStatusLabel(item.status) }}</span>
          </p>
          <p class="mt-1 text-xs text-slate-500">
            触发于 {{ new Date(item.triggerAt).toLocaleString() }} ·
            创建于 {{ new Date(item.createdAt).toLocaleString() }}
          </p>
        </li>
      </ul>
    </section>

  </div>

</template>

