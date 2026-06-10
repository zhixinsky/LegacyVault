<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { VButton } from '@vaultpass/ui';
import { decryptText } from '@/utils/api';
import { buildContactTakeoverMaterials, computeLookupHash, encryptField } from '@/utils/crypto-flow';
import {
  addContactChallenge,
  createTrustedContact,
  getProfile,
  listTrustedContacts,
} from '@/utils/services';

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  scope: string;
}

const contacts = ref<ContactRow[]>([]);
const name = ref('');
const phone = ref('');
const email = ref('');
const relation = ref('');
const scope = ref('request_takeover');
const challengeQuestion = ref('');
const challengeAnswer = ref('');
const mfaCode = ref('');
const mfaEnabled = ref(false);
const loading = ref(true);
const error = ref('');

const scopeOptions = [
  { label: '仅接收提醒', value: 'notify_only' },
  { label: '可申请接管', value: 'request_takeover' },
  { label: '可查看全部', value: 'view_all' },
  { label: '失联后可访问', value: 'inactive_only' },
];

onMounted(async () => {
  try {
    const profile = await getProfile();
    mfaEnabled.value = profile.mfaEnabled;
  } catch {
    // ignore
  }
  await loadContacts();
});

async function loadContacts() {
  loading.value = true;
  try {
    const result = await listTrustedContacts();
    const rows: ContactRow[] = [];
    for (const item of result.items) {
      rows.push({
        id: item.id,
        name: await decryptText(item.nameCiphertext),
        phone: await decryptText(item.phoneCiphertext),
        scope: item.permissionScope,
      });
    }
    contacts.value = rows;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败';
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  if (!name.value || !phone.value) {
    error.value = '请填写姓名和手机号';
    return;
  }

  if (scope.value !== 'notify_only' && (!challengeQuestion.value || !challengeAnswer.value)) {
    error.value = '接管权限需设置至少一个验证问题与答案';
    return;
  }

  try {
    const takeoverMaterials =
      scope.value !== 'notify_only'
        ? await buildContactTakeoverMaterials(challengeQuestion.value, challengeAnswer.value)
        : null;

    const contact = (await createTrustedContact(
      {
        nameCiphertext: await encryptField(name.value),
        phoneCiphertext: await encryptField(phone.value),
        emailCiphertext: await encryptField(email.value || '-'),
        relationCiphertext: relation.value ? await encryptField(relation.value) : undefined,
        permissionScope: scope.value,
        priority: contacts.value.length,
        phoneLookupHash: computeLookupHash(phone.value),
        emailLookupHash: email.value ? computeLookupHash(email.value) : undefined,
        notifyPhone: phone.value.trim(),
        notifyEmail: email.value.trim() || undefined,
        encryptedVaultKeyForContact: takeoverMaterials?.encryptedVaultKeyForContact,
      },
      mfaCode.value || undefined,
    )) as { id: string };

    if (takeoverMaterials) {
      await addContactChallenge(
        {
          contactId: contact.id,
          encryptedQuestion: takeoverMaterials.encryptedQuestion,
          encryptedAnswerHash: takeoverMaterials.encryptedAnswerHash,
          questionLabel: takeoverMaterials.questionLabel,
        },
        mfaCode.value || undefined,
      );
    }

    name.value = '';
    phone.value = '';
    email.value = '';
    relation.value = '';
    challengeQuestion.value = '';
    challengeAnswer.value = '';
    await loadContacts();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '添加失败';
  }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">添加安全联系人</h2>
      <p class="mt-2 text-xs text-slate-500">
        手机号/邮箱将用于数字遗产流程中的接管通知送达（服务端仅存通知用途明文，保险箱内联系信息仍加密存储）。
      </p>
      <div class="mt-4 grid gap-3">
        <input v-model="name" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="姓名" />
        <input v-model="phone" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="手机号" />
        <input v-model="email" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="邮箱（可选）" />
        <input v-model="relation" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="关系（可选）" />
        <select v-model="scope" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option v-for="item in scopeOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <input
          v-model="challengeQuestion"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="验证问题（接管必填）"
        />
        <input
          v-model="challengeAnswer"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="验证答案（接管必填）"
        />
        <input
          v-if="mfaEnabled"
          v-model="mfaCode"
          class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="二次验证码（已启用 MFA 时必填）"
        />
        <VButton variant="primary" @click="handleAdd">加密保存</VButton>
      </div>
      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
    </section>

    <section class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <h2 class="font-semibold text-slate-900">已添加联系人</h2>
      <div v-if="loading" class="mt-6 text-center text-slate-400">加载中...</div>
      <ul v-else-if="contacts.length === 0" class="mt-6 text-center text-slate-400">暂无联系人</ul>
      <ul v-else class="mt-4 divide-y divide-slate-100">
        <li v-for="item in contacts" :key="item.id" class="py-3">
          <p class="font-medium">{{ item.name }}</p>
          <p class="text-sm text-slate-500">{{ item.phone }} · {{ item.scope }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
