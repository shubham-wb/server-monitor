import { Module } from '@nestjs/common';
import { TicketingService } from './ticketing.service';
import { TicketingProviderFactory } from './ticketing-providers/ticketing-provider.factory';

@Module({
  providers: [TicketingService, TicketingProviderFactory],
})
export class TicketingModule {}
