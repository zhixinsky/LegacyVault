import { InheritanceEventStatus } from '@prisma/client';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReminderFrequency = 'quarterly' | 'bimonthly' | 'monthly';

export interface InheritanceRuleConfig {
  inactiveYears: number;
  gracePeriodMonths: number;
  reminderFrequency?: ReminderFrequency | string;
}

export interface WorkflowInput {
  now: Date;
  lastLoginAt: Date;
  inheritancePausedUntil?: Date | null;
  rule: InheritanceRuleConfig;
  event?: {
    status: InheritanceEventStatus;
    lastReminderAt?: Date | null;
    graceEndsAt?: Date | null;
    cooldownEndsAt?: Date | null;
    contactsNotifiedAt?: Date | null;
  } | null;
}

export type WorkflowAction =
  | { type: 'noop' }
  | { type: 'start_reminding' }
  | { type: 'send_user_reminder'; stage: string }
  | { type: 'enter_grace_period'; graceEndsAt: Date }
  | { type: 'notify_contacts' }
  | { type: 'enter_cooldown'; cooldownEndsAt: Date }
  | { type: 'open_contact_verification' };

export function getInactiveDays(now: Date, lastLoginAt: Date) {
  return Math.floor((now.getTime() - lastLoginAt.getTime()) / MS_PER_DAY);
}

export function getReminderIntervalDays(
  inactiveDays: number,
  inactiveYears: number,
  reminderFrequency: ReminderFrequency | string = 'quarterly',
) {
  const frequencyDays: Record<string, number> = {
    quarterly: 90,
    bimonthly: 60,
    monthly: 30,
  };

  const baseInterval = frequencyDays[reminderFrequency] ?? 90;
  const thresholdDays = inactiveYears * 365;
  const firstYear = Math.min(365, thresholdDays);
  const secondYear = Math.min(365 * 2, thresholdDays);

  if (inactiveDays < firstYear) {
    return baseInterval;
  }
  if (inactiveDays < secondYear) {
    return Math.max(30, Math.floor(baseInterval * 0.67));
  }
  if (inactiveDays < thresholdDays) {
    return Math.max(30, Math.floor(baseInterval * 0.5));
  }
  return 30;
}

export function shouldSendReminder(
  now: Date,
  lastReminderAt: Date | null | undefined,
  intervalDays: number,
) {
  if (!lastReminderAt) {
    return true;
  }
  const daysSinceReminder = Math.floor(
    (now.getTime() - lastReminderAt.getTime()) / MS_PER_DAY,
  );
  return daysSinceReminder >= intervalDays;
}

export function evaluateInheritanceWorkflow(input: WorkflowInput): WorkflowAction {
  const { now, lastLoginAt, inheritancePausedUntil, rule, event } = input;

  if (inheritancePausedUntil && inheritancePausedUntil > now) {
    return { type: 'noop' };
  }

  const inactiveDays = getInactiveDays(now, lastLoginAt);
  const thresholdDays = rule.inactiveYears * 365;
  const graceDays = rule.gracePeriodMonths * 30;

  if (inactiveDays < 30) {
    return { type: 'noop' };
  }

  if (!event) {
    return { type: 'start_reminding' };
  }

  if (event.status === InheritanceEventStatus.cancelled || event.status === InheritanceEventStatus.completed) {
    return { type: 'noop' };
  }

  if (inactiveDays >= thresholdDays) {
    if (!event.graceEndsAt) {
      const graceEndsAt = new Date(now.getTime() + graceDays * MS_PER_DAY);
      return { type: 'enter_grace_period', graceEndsAt };
    }

    if (event.graceEndsAt > now) {
      if (shouldSendReminder(now, event.lastReminderAt, 30)) {
        return { type: 'send_user_reminder', stage: 'grace_period' };
      }
      return { type: 'noop' };
    }

    if (!event.contactsNotifiedAt) {
      return { type: 'notify_contacts' };
    }

    if (!event.cooldownEndsAt) {
      const cooldownEndsAt = new Date(now.getTime() + 30 * MS_PER_DAY);
      return { type: 'enter_cooldown', cooldownEndsAt };
    }

    if (event.cooldownEndsAt > now) {
      if (shouldSendReminder(now, event.lastReminderAt, 7)) {
        return { type: 'send_user_reminder', stage: 'cooldown' };
      }
      return { type: 'noop' };
    }

    return { type: 'open_contact_verification' };
  }

  const intervalDays = getReminderIntervalDays(
    inactiveDays,
    rule.inactiveYears,
    rule.reminderFrequency,
  );
  if (shouldSendReminder(now, event.lastReminderAt, intervalDays)) {
    return { type: 'send_user_reminder', stage: 'reminding' };
  }

  return { type: 'noop' };
}
