import { Request } from 'express';

const AUDIT_STRING_LIMIT = 191;

export function getRequestMeta(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    req.ip ||
    req.socket.remoteAddress;

  const deviceIdHeader = req.headers['x-device-id'];
  const deviceId =
    typeof deviceIdHeader === 'string' && deviceIdHeader.trim()
      ? deviceIdHeader.trim().slice(0, 64)
      : undefined;

  return {
    ip: truncate(ip ?? undefined, AUDIT_STRING_LIMIT),
    device: truncate(
      typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      AUDIT_STRING_LIMIT,
    ),
    deviceId,
  };
}

function truncate(value: string | undefined, maxLength: number) {
  return value && value.length > maxLength ? value.slice(0, maxLength) : value;
}
