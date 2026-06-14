import { Repository } from 'typeorm';
import {
  Ticket as TicketType,
  TicketCreate,
  TicketStatus,
} from '../ticketing.types';

import { ITicketingProvider } from './ticketing-provider.interface';

import { Ticket } from '../entities/ticket.entity';
import { Anomaly } from '@/log-analysis/log-analysis-jobs/entities/anomaly.entity';

export class InternalTicketingProvider implements ITicketingProvider {
  constructor(
    private readonly config: Record<string, any>,
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  createTicket(props: TicketCreate): Promise<TicketType> {
    const ticket = this.ticketRepo.create({
      title: props.title,
      description: props.description,
      severity: props.severity,
      status: TicketStatus.OPEN,
      anomaly: props.anomalyId ? { id: props.anomalyId } : undefined,
    });
    return this.ticketRepo.save(ticket);
  }

  getTicket(ticketId: string): Promise<TicketType | null> {
    return this.ticketRepo.findOne({
      where: { id: ticketId },
    });
  }

  async updateTicket(
    ticketId: string,
    props: Pick<TicketType, 'title' | 'description' | 'status'>,
  ): Promise<TicketType> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    Object.assign(ticket, props);
    return this.ticketRepo.save(ticket);
  }
}
