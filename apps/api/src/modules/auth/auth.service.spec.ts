import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuditRiskLevel } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
  };

  const auditLogService = {
    log: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const inheritanceWorkflowService = {
    onUserActivity: jest.fn(),
  };

  const deviceService = {
    trackLogin: jest.fn(),
    isKnownDevice: jest.fn().mockResolvedValue(true),
  };

  const emaySmsService = {
    sendLoginOtp: jest.fn(),
  };

  const wechatAuthService = {
    code2Session: jest.fn(),
    resolvePhoneNumber: jest.fn(),
  };

  const mfaService = {
    verifyUserCode: jest.fn(),
  };

  const ipBlacklistService = {
    assertAllowed: jest.fn().mockResolvedValue(undefined),
    isBlocked: jest.fn().mockResolvedValue(false),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwtService as never,
      configService as never,
      auditLogService as never,
      inheritanceWorkflowService as never,
      deviceService as never,
      emaySmsService as never,
      wechatAuthService as never,
      mfaService as never,
      ipBlacklistService as never,
    );
  });

  it('rejects register without phone and email', async () => {
    await expect(
      service.register(
        {
          encryptedVaultKey: 'enc',
          kdfSalt: 'salt',
          kdfParams: {
            algorithm: 'argon2id',
            memory: 65536,
            iterations: 3,
            parallelism: 4,
          },
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate phone registration', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register(
        {
          phone: '13800138000',
          encryptedVaultKey: 'enc',
          kdfSalt: 'salt',
          kdfParams: {
            algorithm: 'argon2id',
            memory: 65536,
            iterations: 3,
            parallelism: 4,
          },
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('registers user without receiving master password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-1' });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      phone: '13800138000',
      email: null,
      status: 'active',
      mfaEnabled: false,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      encryptedVaultKey: 'enc-key',
      encryptedVaultKeyByRecovery: null,
      recoveryKeyHint: null,
      kdfSalt: 'salt',
      kdfParams: { algorithm: 'argon2id', memory: 65536, iterations: 3, parallelism: 4 },
    });

    const result = await service.register(
      {
        phone: '13800138000',
        encryptedVaultKey: 'enc-key',
        kdfSalt: 'salt',
        kdfParams: {
          algorithm: 'argon2id',
          memory: 65536,
          iterations: 3,
          parallelism: 4,
        },
      },
      { ip: '127.0.0.1' },
    );

    expect(result.accessToken).toBe('mock-token');
    expect(result.vaultKeyBundle.encryptedVaultKey).toBe('enc-key');
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.register',
        riskLevel: AuditRiskLevel.medium,
      }),
    );
  });
});
