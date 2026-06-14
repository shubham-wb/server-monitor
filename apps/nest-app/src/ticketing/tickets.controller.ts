import { Controller, Get, Param } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findAll(currentUser.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findOne(id, currentUser.id);
  }
}
