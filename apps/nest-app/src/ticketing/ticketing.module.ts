import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { LogAnalysisJobsModule } from '@/log-analysis/log-analysis-jobs/log-analysis-jobs.module';
import { Module } from '@nestjs/common';
import { TicketingService } from './ticketing.service';
import { TicketingProviderFactory } from './ticketing-providers/ticketing-provider.factory';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), LogAnalysisJobsModule],
  controllers: [TicketsController],
  providers: [TicketingService, TicketingProviderFactory, TicketsService],
})
export class TicketingModule {}
