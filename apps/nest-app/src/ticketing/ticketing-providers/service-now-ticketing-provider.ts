import { Ticket, TicketCreate, TicketStatus } from '../ticketing.types';
import { ITicketingProvider } from './ticketing-provider.interface';

export class ServiceNowTicketingProvider implements ITicketingProvider {
  constructor(private readonly config: Record<string, any>) {}

  createTicket(props: TicketCreate): Promise<Ticket> {
    return Promise.resolve({
      id: 'random-id',
      title: props.title,
      description: props.description,
      severity: props.severity,
      status: TicketStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  getTicket(ticketId: string): Promise<Ticket | null> {
    throw new Error('Method not implemented.');
  }
  updateTicket(
    ticketId: string,
    props: Pick<Ticket, 'title' | 'description' | 'status'>,
  ): Promise<Ticket> {
    throw new Error('Method not implemented.');
  }
}
