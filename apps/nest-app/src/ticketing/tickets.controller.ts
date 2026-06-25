import { Controller, Get, Param, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(
    @CurrentUser() currentUser: ICurrentUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ticketsService.findAll(currentUser.id, pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findOne(id, currentUser.id);
  }
}
