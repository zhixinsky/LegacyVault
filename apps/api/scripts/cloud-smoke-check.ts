/**
 * 云托管部署联调自检：检查环境变量与 API 健康状态。
 * 用法：pnpm --filter @vaultpass/api cloud:smoke-check
 * 可选：SMOKE_API_URL=https://your-service/api/v1
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface EnvMap {
  [key: string]: string | undefined;
}

interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

function loadEnvFile(): EnvMap {
  const envPath = resolve(__dirname, '../../../.env');
  const env: EnvMap = { ...process.env };

  try {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    console.warn(`未找到 ${envPath}，仅使用进程环境变量`);
  }

  return env;
}

function hasValue(env: EnvMap, key: string) {
  return Boolean(env[key]?.trim());
}

function addConfigCheck(checks: CheckResult[], env: EnvMap, name: string, keys: string[]) {
  const missing = keys.filter((key) => !hasValue(env, key));
  checks.push({
    name,
    pass: missing.length === 0,
    detail: missing.length ? `缺少: ${missing.join(', ')}` : '已配置',
  });
}

async function main() {
  const env = loadEnvFile();
  const checks: CheckResult[] = [];

  const hasDatabase =
    hasValue(env, 'DATABASE_URL') ||
    (hasValue(env, 'MYSQL_ADDRESS') &&
      hasValue(env, 'MYSQL_USERNAME') &&
      hasValue(env, 'MYSQL_PASSWORD'));
  checks.push({
    name: '数据库（DATABASE_URL 或 MYSQL_*）',
    pass: hasDatabase,
    detail: hasDatabase
      ? hasValue(env, 'DATABASE_URL')
        ? '已配置 DATABASE_URL'
        : '将使用 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD 自动拼接'
      : '缺少 DATABASE_URL 或 MYSQL_ADDRESS+MYSQL_USERNAME+MYSQL_PASSWORD',
  });
  addConfigCheck(checks, env, 'JWT_SECRET', ['JWT_SECRET']);
  addConfigCheck(checks, env, '微信开放接口 WX_USE_OPENAPI', ['WX_USE_OPENAPI', 'WX_APPID']);
  addConfigCheck(checks, env, '云托管 COS', ['TCB_ENV_ID', 'COS_BUCKET', 'COS_REGION']);

  const storageProvider = env.STORAGE_PROVIDER ?? 'local';
  checks.push({
    name: '对象存储 STORAGE_PROVIDER',
    pass: storageProvider === 'wechat_cos' || storageProvider === 'local',
    detail: storageProvider,
  });

  if (env.SMS_PROVIDER === 'emay') {
    addConfigCheck(checks, env, '亿美短信', ['EMAY_APPID', 'EMAY_SECRETKEY']);
    addConfigCheck(checks, env, '亿美模板 ID', [
      'EMAY_TEMPLATE_ID_OTP',
      'EMAY_TEMPLATE_ID_INHERITANCE',
      'EMAY_TEMPLATE_ID_CONTACT_NOTICE',
      'EMAY_TEMPLATE_ID_SECURITY_ALERT',
    ]);
  }

  const apiPrefix = env.API_PREFIX ?? 'api/v1';
  const apiPort = env.API_PORT ?? '3000';
  const apiBase =
    process.env.SMOKE_API_URL?.replace(/\/$/, '') ??
    `http://localhost:${apiPort}/${apiPrefix}`;

  try {
    const response = await fetch(`${apiBase}/health`);
    const body = await response.text();
    checks.push({
      name: `API 健康检查 ${apiBase}/health`,
      pass: response.ok,
      detail: body.slice(0, 120),
    });
  } catch (error) {
    checks.push({
      name: `API 健康检查 ${apiBase}/health`,
      pass: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  console.log('\n=== VaultPass 云托管联调自检 ===\n');

  let failed = 0;
  for (const check of checks) {
    const mark = check.pass ? '✓' : '✗';
    console.log(`${mark} ${check.name}`);
    if (check.detail) {
      console.log(`  ${check.detail}`);
    }
    if (!check.pass) failed += 1;
  }

  console.log('\n--- 小程序发布后需人工验证 ---');
  const manual = [
    '手机号快捷登录（/wxa/business/getuserphonenumber 白名单）',
    '微信登录 / 绑定（/sns/jscode2session）',
    `PC 扫码登录页 ${env.WX_SCAN_LOGIN_PAGE ?? 'pages/scan-login/scan-login'}`,
    `PC 绑定微信页 ${env.WX_WX_BIND_PAGE ?? 'pages/wx-bind-scan/wx-bind-scan'}`,
    '加密文件上传 / 下载（/tcb/uploadfile、/tcb/batchdownloadfile）',
    '新设备登录 MFA + 安全告警短信',
  ];
  manual.forEach((item, index) => console.log(`${index + 1}. ${item}`));

  console.log(`\n结果：${checks.length - failed}/${checks.length} 项自动检查通过\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
