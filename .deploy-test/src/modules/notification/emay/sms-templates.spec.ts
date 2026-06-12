import { extractSmsVariables, resolveTemplateType } from './sms-templates';

describe('sms-templates', () => {
  it('maps auth.security.alert to securityAlert template', () => {
    expect(resolveTemplateType('auth.security.alert')).toBe('securityAlert');
  });

  it('maps inheritance notifications to inheritance template', () => {
    expect(resolveTemplateType('inheritance.user.reminder')).toBe('inheritance');
  });

  it('extracts message variable for security alert', () => {
    const message = '检测到新设备登录，IP 203.0.113.10';
    expect(extractSmsVariables('auth.security.alert', message)).toEqual({
      message,
    });
  });
});
