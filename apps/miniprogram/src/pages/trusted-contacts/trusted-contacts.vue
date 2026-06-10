<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { decryptText } from '@/utils/api';
import {
  buildContactTakeoverMaterials,
  computeLookupHash,
  encryptField,
} from '@/utils/crypto-flow';
import { addContactChallenge, createTrustedContact, listTrustedContacts } from '@/utils/services';

const contacts = ref<Array<{ id: string; name: string; scope: string }>>([]);
const name = ref('');
const phone = ref('');
const email = ref('');
const relation = ref('');
const challengeQuestion = ref('');
const challengeAnswer = ref('');
const loading = ref(false);

const scopeOptions = [
  { label: '仅接收提醒', value: 'notify_only' },
  { label: '可申请接管', value: 'request_takeover' },
  { label: '可查看全部', value: 'view_all' },
  { label: '失联后可访问', value: 'inactive_only' },
];
const scopeIndex = ref(1);

onShow(loadContacts);

async function loadContacts() {
  loading.value = true;
  try {
    const result = await listTrustedContacts();
    const parsed: Array<{ id: string; name: string; scope: string }> = [];

    for (const item of result.items) {
      parsed.push({
        id: item.id,
        name: await decryptText(item.nameCiphertext),
        scope: item.permissionScope,
      });
    }

    contacts.value = parsed;
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function handleAdd() {
  if (!name.value || !phone.value) {
    uni.showToast({ title: '请填写姓名和手机号', icon: 'none' });
    return;
  }

  const scope = scopeOptions[scopeIndex.value]?.value ?? 'request_takeover';
  if (scope !== 'notify_only' && (!challengeQuestion.value || !challengeAnswer.value)) {
    uni.showToast({ title: '接管权限需设置验证问题', icon: 'none' });
    return;
  }

  try {
    const takeoverMaterials =
      scope !== 'notify_only'
        ? await buildContactTakeoverMaterials(challengeQuestion.value, challengeAnswer.value)
        : null;

    const contact = await createTrustedContact({
      nameCiphertext: await encryptField(name.value),
      phoneCiphertext: await encryptField(phone.value),
      emailCiphertext: await encryptField(email.value || '-'),
      relationCiphertext: relation.value ? await encryptField(relation.value) : undefined,
      permissionScope: scope,
      priority: contacts.value.length,
      phoneLookupHash: computeLookupHash(phone.value),
      emailLookupHash: email.value ? computeLookupHash(email.value) : undefined,
      notifyPhone: phone.value.trim(),
      notifyEmail: email.value.trim() || undefined,
      encryptedVaultKeyForContact: takeoverMaterials?.encryptedVaultKeyForContact,
    });

    if (takeoverMaterials) {
      await addContactChallenge({
        contactId: contact.id,
        encryptedQuestion: takeoverMaterials.encryptedQuestion,
        encryptedAnswerHash: takeoverMaterials.encryptedAnswerHash,
        questionLabel: takeoverMaterials.questionLabel,
      });
    }

    name.value = '';
    phone.value = '';
    email.value = '';
    relation.value = '';
    challengeQuestion.value = '';
    challengeAnswer.value = '';
    uni.showToast({ title: '已添加', icon: 'success' });
    loadContacts();
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '添加失败',
      icon: 'none',
    });
  }
}

function onScopeChange(event: { detail: { value: string | number } }) {
  scopeIndex.value = Number(event.detail.value);
}
</script>

<template>
  <view class="container">
    <view class="card">
      <text class="title">添加安全联系人</text>
      <text class="subtitle">联系人信息会在本地加密后上传</text>

      <text class="field-label">姓名</text>
      <input v-model="name" class="input" placeholder="联系人姓名" />

      <text class="field-label">手机号</text>
      <input v-model="phone" class="input" type="number" placeholder="手机号" />

      <text class="field-label">邮箱</text>
      <input v-model="email" class="input" placeholder="邮箱（可选）" />

      <text class="field-label">关系</text>
      <input v-model="relation" class="input" placeholder="例如：配偶、律师" />

      <text class="field-label">权限范围</text>
      <picker :range="scopeOptions" range-key="label" :value="scopeIndex" @change="onScopeChange">
        <view class="picker-value">{{ scopeOptions[scopeIndex]?.label }}</view>
      </picker>

      <text class="field-label">验证问题（接管必填）</text>
      <input v-model="challengeQuestion" class="input" placeholder="例如：第一只宠物叫什么" />

      <text class="field-label">验证答案</text>
      <input v-model="challengeAnswer" class="input" placeholder="仅联系人知晓的答案" />

      <button class="btn btn-primary" @tap="handleAdd">加密保存</button>
      <navigator url="/pages/contact-takeover/contact-takeover" class="link">联系人接管验证入口</navigator>
    </view>

    <view class="card">
      <text class="section-title">已添加联系人</text>
      <view v-if="contacts.length === 0" class="empty">暂无联系人</view>
      <view v-else>
        <view v-for="item in contacts" :key="item.id" class="list-item">
          <view>
            <text>{{ item.name }}</text>
            <text class="hint">{{ item.scope }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@import '@/uni.scss';

.section-title {
  font-size: 30rpx;
  font-weight: 600;
}

.link {
  display: block;
  margin-top: 24rpx;
  text-align: center;
  color: #2563eb;
  font-size: 26rpx;
}
</style>
