import { Module } from '@nestjs/common';
import { TicketingService } from './ticketing.service';
import { TicketingProviderFactory } from './ticketing-providers/ticketing-provider.factory';
import { LogAnalysisJobsModule } from '@/log-analysis/log-analysis-jobs/log-analysis-jobs.module';

@Module({
  providers: [TicketingService, TicketingProviderFactory],
  imports: [LogAnalysisJobsModule],
})
export class TicketingModule {}
