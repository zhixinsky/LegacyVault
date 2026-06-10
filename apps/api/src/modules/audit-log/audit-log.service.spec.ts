import { AuditActorType, AuditRiskLevel } from '@prisma/client';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService(prisma as never);
  });

  it('writes audit log without sensitive payload fields', async () => {
    prisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

    await service.log({
      userId: 'user-1',
      actorId: 'user-1',
      action: 'vault.item.create',
      ip: '127.0.0.1',
      device: 'jest',
      riskLevel: AuditRiskLevel.medium,
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'vault.item.create',
        actorType: AuditActorType.user,
        ip: '127.0.0.1',
        device: 'jest',
        riskLevel: AuditRiskLevel.medium,
        user: { connect: { id: 'user-1' } },
      }),
    });

    const payload = prisma.auditLog.create.mock.calls[0][0].data;
    expect(JSON.stringify(payload)).not.toMatch(/password/i);
  });
});
