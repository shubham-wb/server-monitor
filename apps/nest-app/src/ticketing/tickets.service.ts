import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  findAll(ownerId: string) {
    return this.ticketRepo.find({
      where: {
        anomaly: {
          logAnalysisJob: {
            ownerId,
          },
        },
      },
    });
  }

  findOne(id: string, ownerId: string) {
    return this.ticketRepo.findOne({
      where: {
        id,
        anomaly: {
          logAnalysisJob: {
            ownerId,
          },
        },
      },
    });
  }
}
