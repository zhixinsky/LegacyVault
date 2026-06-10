import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InheritanceWorkflowService } from './inheritance-workflow.service';

@Injectable()
export class InheritanceSchedulerService {
  private readonly logger = new Logger(InheritanceSchedulerService.name);
  private running = false;

  constructor(
    private readonly workflowService: InheritanceWorkflowService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyScan() {
    if (this.config.get<string>('INHERITANCE_CRON_ENABLED', 'true') !== 'true') {
      return;
    }

    await this.runScan('cron');
  }

  async runScan(trigger: 'cron' | 'manual' = 'manual') {
    if (this.running) {
      return { skipped: true, reason: 'scan already running' };
    }

    this.running = true;
    try {
      this.logger.log(`Starting inheritance scan (${trigger})`);
      const result = await this.workflowService.scanAllUsers();
      this.logger.log(
        `Inheritance scan finished: scanned=${result.scanned}, processed=${result.processed}`,
      );
      return { trigger, ...result };
    } finally {
      this.running = false;
    }
  }
}
