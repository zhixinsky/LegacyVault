import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const MfaCode = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  const header = request.headers['x-mfa-code'];
  return typeof header === 'string' ? header.trim() : undefined;
});
