# VaultPass 亿美软通短信模板（控制台导入用）

在亿美后台 **手动创建** 以下模板，按分类选择并提交审核。审核通过后，将 `templateId` 写入项目根目录 `.env`。

> 签名在亿美账号侧配置，模板正文 **不要** 写 `【签名】` 前缀。  
> 变量格式为 `{#变量名#}`（个性模板）。

---

## 1. 安全验证码

| 项 | 值 |
|---|---|
| 模板名称 | VaultPass 安全验证码 |
| 分类 | **验证码** |
| .env 变量 | `EMAY_TEMPLATE_ID_OTP` |

**模板内容：**

```
VaultPass安全验证：您的验证码为{#code#}，10分钟内有效。如非本人操作请忽略。
```

**变量：**

| 变量 | 说明 |
|---|---|
| `{#code#}` | 6 位数字验证码 |

**使用场景：** 安全联系人接管 OTP 验证

---

## 2. 数字遗产提醒

| 项 | 值 |
|---|---|
| 模板名称 | VaultPass 数字遗产提醒 |
| 分类 | **行业通知** |
| .env 变量 | `EMAY_TEMPLATE_ID_INHERITANCE` |

**模板内容：**

```
VaultPass提醒您：{#message#}。请尽快登录 APP 或小程序确认账户仍在使用。
```

**变量：**

| 变量 | 说明 |
|---|---|
| `{#message#}` | 提醒正文，如「账户长期未活动」「已进入验证期」等 |

**使用场景：** 数字遗产工作流各阶段用户提醒

---

## 3. 安全联系人接管通知

| 项 | 值 |
|---|---|
| 模板名称 | VaultPass 联系人接管通知 |
| 分类 | **行业通知** |
| .env 变量 | `EMAY_TEMPLATE_ID_CONTACT_NOTICE` |

**模板内容：**

```
VaultPass通知：账户持有人长期未活动，数字遗产流程已启动。您的接管令牌为{#token#}，请按指引完成身份验证。
```

**变量：**

| 变量 | 说明 |
|---|---|
| `{#token#}` | 接管令牌（联系人凭此进入验证页） |

**使用场景：** 数字遗产流程进入「通知联系人」阶段

---

## 4. 登录安全告警

| 项 | 值 |
|---|---|
| 模板名称 | VaultPass 登录安全告警 |
| 分类 | **行业通知** |
| .env 变量 | `EMAY_TEMPLATE_ID_SECURITY_ALERT` |

**模板内容：**

```
VaultPass安全提醒：{#message#}。如非本人操作请立即登录并修改密码、启用二次验证。
```

**变量：**

| 变量 | 说明 |
|---|---|
| `{#message#}` | 告警正文，如新设备登录、异地 IP 等 |

**使用场景：** `auth.security.alert` 新设备 / 异地登录安全通知

---

## .env 配置示例

```env
SMS_PROVIDER=emay
EMAY_APPID=你的AppId
EMAY_SECRETKEY=你的SecretKey
EMAY_BASE_URL=http://www.btom.cn:8080
EMAY_AUTO_CREATE_TEMPLATES=false

EMAY_TEMPLATE_ID_OTP=审核通过后的模板ID
EMAY_TEMPLATE_ID_INHERITANCE=审核通过后的模板ID
EMAY_TEMPLATE_ID_CONTACT_NOTICE=审核通过后的模板ID
EMAY_TEMPLATE_ID_SECURITY_ALERT=审核通过后的模板ID
```

也可运行命令在终端打印以上内容：

```bash
pnpm --filter @vaultpass/api sms:print-templates
```
