import { Request } from 'express';

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
    ip: ip ?? undefined,
    device: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    deviceId,
  };
}
