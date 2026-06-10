import { createHash, createHmac } from 'node:crypto';

export interface SmsSendInput {
  phone: string;
  message: string;
  accessKey: string;
  secretKey: string;
  signName: string;
  templateCode: string;
  templateParam?: Record<string, string>;
}

/** 阿里云短信（ dysmsapi ） */
export async function sendAliyunSms(input: SmsSendInput) {
  const params: Record<string, string> = {
    AccessKeyId: input.accessKey,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: input.phone,
    RegionId: 'cn-hangzhou',
    SignName: input.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: `${Date.now()}${Math.random()}`,
    SignatureVersion: '1.0',
    TemplateCode: input.templateCode,
    TemplateParam: JSON.stringify(
      input.templateParam ?? { code: input.message.replace(/\D/g, '').slice(0, 6) },
    ),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  };

  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key] ?? '')}`)
    .join('&');

  const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(sorted)}`;
  const signature = createHmac('sha1', `${input.secretKey}&`)
    .update(stringToSign)
    .digest('base64');

  const url = `https://dysmsapi.aliyuncs.com/?${sorted}&Signature=${encodeURIComponent(signature)}`;
  const response = await fetch(url);
  const body = (await response.json()) as { Code?: string; Message?: string };

  if (!response.ok || body.Code !== 'OK') {
    throw new Error(body.Message || '短信发送失败');
  }
}

/** 腾讯云短信（简化 REST 调用） */
export async function sendTencentSms(input: SmsSendInput & { sdkAppId: string }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    PhoneNumberSet: [`+86${input.phone.replace(/^\+86/, '')}`],
    SmsSdkAppId: input.sdkAppId,
    SignName: input.signName,
    TemplateId: input.templateCode,
    TemplateParamSet: [input.templateParam?.code ?? input.message.replace(/\D/g, '').slice(0, 6)],
  };

  const response = await fetch('https://sms.tencentcloudapi.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TC-Action': 'SendSms',
      'X-TC-Version': '2021-01-11',
      'X-TC-Timestamp': String(timestamp),
      Authorization: buildTencentAuthorization(input.secretKey, timestamp, payload),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('腾讯云短信发送失败');
  }
}

function buildTencentAuthorization(secretKey: string, timestamp: number, payload: unknown) {
  const hashed = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return createHmac('sha256', secretKey).update(`${timestamp}${hashed}`).digest('base64');
}
