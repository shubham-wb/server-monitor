import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LogAnalysisJobsService } from './log-analysis-jobs.service';
import { CreateLogAnalysisJobDto } from './dto/create-log-analysis-job.dto';
import { UpdateLogAnalysisJobDto } from './dto/update-log-analysis-job.dto';
import type { ICurrentUser } from '@/auth/current-user.interface';
import { CurrentUser } from '@/auth/current-user.decorator';
import { UpdateAnomalyDto } from './dto/update-anomaly.dto';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('log-analysis-jobs')
@ApiBearerAuth()
@Controller('log-analysis-jobs')
export class LogAnalysisJobsController {
  constructor(
    private readonly logAnalysisJobsService: LogAnalysisJobsService,
  ) {}

  @Post()
  create(
    @Body() createLogAnalysisJobDto: CreateLogAnalysisJobDto,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisJobsService.create(
      createLogAnalysisJobDto,
      currentUser.id,
    );
  }

  @Get()
  findAll(@CurrentUser() currentUser: ICurrentUser) {
    return this.logAnalysisJobsService.findAll(currentUser.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: ICurrentUser) {
    return this.logAnalysisJobsService.findOne(id, currentUser.id);
  }

  @Get(':jobId/anomalies')
  listAnomalies(
    @Param('jobId') jobId: string,
    @CurrentUser() currentUser: ICurrentUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.logAnalysisJobsService.listAnomalies(
      jobId,
      currentUser.id,
      pagination,
    );
  }

  @Get(':jobId/anomalies/:id')
  getAnomaly(
    @Param('jobId') jobId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisJobsService.getAnomalyForJob(
      jobId,
      id,
      currentUser.id,
    );
  }

  @Patch(':jobId/anomalies/:id')
  updateAnomaly(
    @Param('jobId') jobId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnomalyDto,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisJobsService.updateAnomalyStatus(
      jobId,
      id,
      currentUser.id,
      dto.status,
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLogAnalysisJobDto: UpdateLogAnalysisJobDto,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisJobsService.update(
      id,
      updateLogAnalysisJobDto,
      currentUser.id,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() currentUser: ICurrentUser) {
    return this.logAnalysisJobsService.remove(id, currentUser.id);
  }
}
