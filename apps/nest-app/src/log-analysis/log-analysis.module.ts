import { Module } from '@nestjs/common';
import { LogAnalysisJobsModule } from './log-analysis-jobs/log-analysis-jobs.module';
import { LogAnalysisController } from './log-analysis.controller';
import { LogAnalysisJobsService } from './log-analysis-jobs/log-analysis-jobs.service';

@Module({
  imports: [LogAnalysisJobsModule],
  controllers: [LogAnalysisController],
  providers: [LogAnalysisJobsService],
  exports: [LogAnalysisJobsService],
})
export class LogAnalysisModule {}
