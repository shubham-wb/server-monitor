import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceNowTicketingProvider } from './service-now-ticketing-provider';
import { InternalTicketingProvider } from './internal-ticketing-provider';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TicketingProviderFactory {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
  ) {}

  create(config: Record<string, any>) {
    switch (config.type) {
      case 'internal':
      case InternalTicketingProvider.name:
        return new InternalTicketingProvider(config, this.ticketRepo);
      case 'servicenow':
      case ServiceNowTicketingProvider.name:
        return new ServiceNowTicketingProvider(config);
      default:
        throw new Error(`Unknown ticketing provider type: ${config.type}`);
    }
  }
}
