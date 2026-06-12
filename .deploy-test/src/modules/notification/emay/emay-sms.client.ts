import { decryptEmayPayload, encryptEmayPayload } from './emay-crypto.util';

export interface EmayClientConfig {
  appId: string;
  secretKey: string;
  baseUrl: string;
}

async function emayRequest<T>(config: EmayClientConfig, urlPath: string, payload: Record<string, unknown>) {
  const jsonStr = JSON.stringify({
    ...payload,
    requestTime: Date.now(),
    requestValidPeriod: 60,
  });
  const encryptedBytes = encryptEmayPayload(jsonStr, config.secretKey);

  const response = await fetch(`${config.baseUrl}${urlPath}`, {
    method: 'POST',
    headers: {
      appId: config.appId,
      'Content-Type': 'application/octet-stream',
      encode: 'UTF-8',
    },
    body: encryptedBytes,
  });

  const resultCode = response.headers.get('result');
  if (resultCode !== 'SUCCESS') {
    throw new Error(`亿美接口错误码: ${resultCode || 'UNKNOWN'}`);
  }

  const decrypted = decryptEmayPayload(Buffer.from(await response.arrayBuffer()), config.secretKey);
  return JSON.parse(decrypted) as T;
}

export async function createEmayTemplate(config: EmayClientConfig, templateContent: string) {
  const result = await emayRequest<{ templateId?: string }>(config, '/inter/createTemplateSMS', {
    templateContent,
  });
  if (!result.templateId) {
    throw new Error('创建模板失败：未返回 templateId');
  }
  return String(result.templateId);
}

export async function queryEmayTemplate(config: EmayClientConfig, templateId: string) {
  const result = await emayRequest<{ templateId?: string; status?: string | number }>(
    config,
    '/inter/queryTemplateSMS',
    { templateId: String(templateId) },
  );
  return {
    templateId: String(result.templateId || templateId),
    status: result.status == null ? null : String(result.status),
  };
}

export async function sendEmayVariableSms(
  config: EmayClientConfig,
  input: {
    phone: string;
    templateId: string;
    variables: Record<string, string>;
    customSmsId?: string;
  },
) {
  const cleanPhone = String(input.phone).trim().replace(/^(\+86)/, '');
  if (!/^1\d{10}$/.test(cleanPhone)) {
    throw new Error('手机号格式不正确');
  }

  const businessData = {
    smses: [
      {
        mobile: cleanPhone,
        customSmsId: input.customSmsId ?? `${Date.now()}`,
        content: input.variables,
      },
    ],
    templateId: String(input.templateId),
    timerTime: null,
    requestTime: Date.now(),
    requestValidPeriod: 60,
  };

  const encryptedBytes = encryptEmayPayload(JSON.stringify(businessData), config.secretKey);
  const response = await fetch(`${config.baseUrl}/inter/sendTemplateVariableSMS`, {
    method: 'POST',
    headers: {
      appId: config.appId,
      'Content-Type': 'application/octet-stream',
      encode: 'UTF-8',
    },
    body: encryptedBytes,
  });

  const resultCode = response.headers.get('result');
  if (resultCode !== 'SUCCESS') {
    throw new Error(`亿美接口错误码: ${resultCode || 'UNKNOWN'}`);
  }
}
