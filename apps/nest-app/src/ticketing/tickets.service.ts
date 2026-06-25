import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { paginate, PaginatedResult } from '@/shared/dto/paginated-result';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async findAll(
    ownerId: string,
    { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResult<Ticket>> {
    const [data, total] = await this.ticketRepo.findAndCount({
      where: {
        anomaly: {
          logAnalysisJob: {
            ownerId,
          },
        },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, { page, limit });
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
