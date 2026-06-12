/**
 * 打印 VaultPass 亿美短信模板，供控制台手动创建并导入
 * 用法：pnpm --filter @vaultpass/api sms:print-templates
 */
import { VAULTPASS_SMS_TEMPLATES } from '../src/modules/notification/emay/sms-templates';

console.log('请在亿美后台手动创建以下模板，审核通过后把 templateId 写入 .env\n');

Object.values(VAULTPASS_SMS_TEMPLATES).forEach((item, index) => {
  console.log(`========== ${index + 1}. ${item.label} ==========`);
  console.log(`分类：${item.category}`);
  console.log(`.env 变量：${item.envKey}`);
  console.log('模板内容：');
  console.log(item.getContent());
  console.log('变量说明：');
  if (item.type === 'otp') {
    console.log('  {#code#} - 6 位验证码');
  } else if (item.type === 'inheritance' || item.type === 'securityAlert') {
    console.log('  {#message#} - 提醒正文');
  } else {
    console.log('  {#token#} - 安全联系人接管令牌');
  }
  console.log('');
});

console.log('配置示例：');
console.log('SMS_PROVIDER=emay');
console.log('EMAY_APPID=你的AppId');
console.log('EMAY_SECRETKEY=你的SecretKey');
console.log('EMAY_BASE_URL=http://www.btom.cn:8080');
console.log('EMAY_TEMPLATE_ID_OTP=审核通过后的模板ID');
console.log('EMAY_TEMPLATE_ID_INHERITANCE=审核通过后的模板ID');
console.log('EMAY_TEMPLATE_ID_CONTACT_NOTICE=审核通过后的模板ID');
console.log('EMAY_TEMPLATE_ID_SECURITY_ALERT=审核通过后的模板ID');
