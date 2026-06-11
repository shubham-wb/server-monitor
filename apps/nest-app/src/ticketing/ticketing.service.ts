import { AnomalyCreatedEvent } from '@/shared/events/anomaly.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TicketingProviderFactory } from './ticketing-providers/ticketing-provider.factory';
import { TicketSeverity } from './ticketing.types';
import {
  AnomalySeverity,
  AnomalyStatus,
} from '@/log-analysis/log-analysis-jobs/entities/anomaly.entity';
import { LogAnalysisJobsService } from '@/log-analysis/log-analysis-jobs/log-analysis-jobs.service';

@Injectable()
export class TicketingService {
  constructor(
    private readonly ticketingProviderFactory: TicketingProviderFactory,
    private readonly logAnalysisJobsService: LogAnalysisJobsService,
  ) {}

  @OnEvent(AnomalyCreatedEvent.name)
  async handleAnomalyCreatedEvent(event: AnomalyCreatedEvent) {
    const { anomalyId, jobId, ownerId } = event.payload;

    const providerConfig =
      await this.logAnalysisJobsService.getTicketingSystemConfig(jobId);

    if (!providerConfig?.type) {
      return;
    }

    const provider = this.ticketingProviderFactory.create(providerConfig);

    const anomaly = await this.logAnalysisJobsService.getAnomaly(
      anomalyId,
      ownerId,
    );

    if (!anomaly || anomaly.status !== AnomalyStatus.OPEN) {
      return;
    }

    return provider.createTicket({
      title: anomaly.title,
      description: anomaly.description,
      severity: this.mapAnomalyToTicketSeverity(anomaly.severity),
    });
  }

  private mapAnomalyToTicketSeverity(
    severity: AnomalySeverity,
  ): TicketSeverity {
    switch (severity) {
      case AnomalySeverity.LOW:
        return TicketSeverity.LOW;
      case AnomalySeverity.MEDIUM:
        return TicketSeverity.MEDIUM;
      case AnomalySeverity.HIGH:
        return TicketSeverity.HIGH;
      default:
        return TicketSeverity.LOW;
    }
  }
}
