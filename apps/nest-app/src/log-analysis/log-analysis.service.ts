/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { AnomalySeverity } from './log-analysis-jobs/entities/anomaly.entity';
import { LogAnalysisJobsService } from './log-analysis-jobs/log-analysis-jobs.service';

@Injectable()
export class LogAnalysisService {
  constructor(private logAnalysisJobService: LogAnalysisJobsService) {}
  async ingestLogs(
    jobId: string,
    ownerId: string,
    logs: Array<Record<string, any>>,
  ) {
    const job = await this.logAnalysisJobService.findOne(jobId, ownerId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    for (const log of logs) {
      const message = log['message'] || 'Untitled Log Message';
      const level = log['level'] || 'error';

      await this.logAnalysisJobService.addAnomaly(job, {
        title: message,
        description: message,
        severity:
          level === 'critical' ? AnomalySeverity.HIGH : AnomalySeverity.MEDIUM,
      });
    }
  }
}
