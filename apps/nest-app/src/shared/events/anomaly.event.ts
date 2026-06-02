import { Anomaly } from '@/log-analysis/log-analysis-jobs/entities/anomaly.entity';
import { AppEvent } from './app-event';
import { LogAnalysisJob } from '@/log-analysis/log-analysis-jobs/entities/log-analysis-job.entity';

export interface AnomalyCreatedEventPayload {
  anomaly: Anomaly;
  job: LogAnalysisJob;
}

export class AnomalyCreatedEvent extends AppEvent<AnomalyCreatedEventPayload> {}
