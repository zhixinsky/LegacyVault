import { InheritanceEventStatus } from '@prisma/client';
import {
  evaluateInheritanceWorkflow,
  getInactiveDays,
  getReminderIntervalDays,
  MS_PER_DAY,
} from './inheritance-workflow.util';

describe('inheritance workflow', () => {
  const rule = { inactiveYears: 3, gracePeriodMonths: 12 };
  const lastLoginAt = new Date('2020-01-01T00:00:00.000Z');

  it('returns noop for recently active users', () => {
    const action = evaluateInheritanceWorkflow({
      now: new Date('2020-01-20T00:00:00.000Z'),
      lastLoginAt,
      rule,
      event: null,
    });

    expect(action.type).toBe('noop');
  });

  it('starts reminding after 30 days inactive', () => {
    const action = evaluateInheritanceWorkflow({
      now: new Date('2020-02-15T00:00:00.000Z'),
      lastLoginAt,
      rule,
      event: null,
    });

    expect(action.type).toBe('start_reminding');
  });

  it('enters grace period after threshold', () => {
    const now = new Date(lastLoginAt.getTime() + 3 * 365 * MS_PER_DAY);
    const action = evaluateInheritanceWorkflow({
      now,
      lastLoginAt,
      rule,
      event: {
        status: InheritanceEventStatus.reminding,
        lastReminderAt: new Date(now.getTime() - 40 * MS_PER_DAY),
      },
    });

    expect(action.type).toBe('enter_grace_period');
  });

  it('opens contact verification after cooldown', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const action = evaluateInheritanceWorkflow({
      now,
      lastLoginAt,
      rule,
      event: {
        status: InheritanceEventStatus.contact_verification,
        graceEndsAt: new Date('2024-01-01T00:00:00.000Z'),
        contactsNotifiedAt: new Date('2024-02-01T00:00:00.000Z'),
        cooldownEndsAt: new Date('2026-01-01T00:00:00.000Z'),
        lastReminderAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    expect(action.type).toBe('open_contact_verification');
  });

  it('calculates reminder intervals by inactive year and frequency', () => {
    expect(getReminderIntervalDays(100, 3, 'quarterly')).toBe(90);
    expect(getReminderIntervalDays(400, 3, 'quarterly')).toBe(60);
    expect(getReminderIntervalDays(800, 3, 'quarterly')).toBe(45);
    expect(getReminderIntervalDays(100, 3, 'monthly')).toBe(30);
    expect(getInactiveDays(new Date('2020-04-01'), lastLoginAt)).toBeGreaterThan(30);
  });
});
