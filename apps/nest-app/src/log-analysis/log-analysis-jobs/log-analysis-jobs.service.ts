import { LogSourcesService } from '@/log-sources/log-sources.service';
import { RemoteServersService } from '@/remote-servers/remote-servers.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateLogAnalysisJobDto } from './dto/create-log-analysis-job.dto';
import { UpdateLogAnalysisJobDto } from './dto/update-log-analysis-job.dto';
import { Anomaly, AnomalyStatus } from './entities/anomaly.entity';
import {
  LogAnalysisJob,
  LogAnalysisJobStatus,
} from './entities/log-analysis-job.entity';
import { EventEmitter2 as EventEmitter } from '@nestjs/event-emitter';
import { AnomalyCreatedEvent } from '@/shared/events/anomaly.event';
import { paginate, PaginatedResult } from '@/shared/dto/paginated-result';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';

@Injectable()
export class LogAnalysisJobsService {
  constructor(
    @InjectRepository(LogAnalysisJob)
    private repo: Repository<LogAnalysisJob>,
    private logSourcesService: LogSourcesService,
    private remoteServersService: RemoteServersService,
    @InjectRepository(Anomaly)
    private anomalyRepo: Repository<Anomaly>,
    private eventEmitter: EventEmitter,
  ) {}

  async getTicketingSystemConfig(jobId: string) {
    const job = await this.repo.findOne({
      where: {
        id: jobId,
      },
      select: {
        ticketingSystemConfig: true,
      },
    });
    return job?.ticketingSystemConfig;
  }

  getAnomaly(anomalyId: string, ownerId: string) {
    return this.anomalyRepo.findOne({
      where: {
        id: anomalyId,
        logAnalysisJob: { ownerId },
      },
    });
  }

  async create(props: CreateLogAnalysisJobDto, ownerId: string) {
    const remoteServer = await this.remoteServersService.getById(
      props.remoteServerId,
      ownerId,
    );

    if (!remoteServer) {
      throw new BadRequestException('Remote server not found');
    }

    const logSource = props.logSourceId
      ? await this.logSourcesService.findOne(props.logSourceId, ownerId)
      : null;

    const logAnalysisJob = this.repo.create({
      ...props,
      ownerId,
      status: LogAnalysisJobStatus.INITIALIZED,
      logSource: logSource ?? undefined,
      remoteServer,
    });
    return this.repo.save(logAnalysisJob);
  }

  findAll(ownerId: string) {
    return this.repo.find({ where: { ownerId } });
  }

  findOne(id: string, ownerId: string) {
    return this.repo.findOneBy({ id, ownerId });
  }

  private async getById(id: string, ownerId: string) {
    const logAnalysisJob = await this.findOne(id, ownerId);
    if (!logAnalysisJob) {
      throw new NotFoundException('Log analysis job not found ');
    }
    return logAnalysisJob;
  }

  async update(
    id: string,
    updateLogAnalysisJobDto: UpdateLogAnalysisJobDto,
    ownerId: string,
  ) {
    const logAnalysisJob = await this.getById(id, ownerId);
    return this.repo.save({ ...logAnalysisJob, ...updateLogAnalysisJobDto });
  }
  /**
   * Transition a job to RUNNING the first time it does real work (ingest).
   * Idempotent: a no-op once the job is already running, so repeated ingests
   * don't issue redundant writes. The only lifecycle signal we have without a
   * scheduler (see MVP_PLAN.md M2.1).
   */
  async remove(id: string, ownerId: string) {
    await this.getById(id, ownerId);
    return this.repo.delete({ id, ownerId });
  }
  async markRunning(job: LogAnalysisJob) {
    if (job.status === LogAnalysisJobStatus.RUNNING) {
      return job;
    }
    job.status = LogAnalysisJobStatus.RUNNING;
    return this.repo.save(job);
  }
  async addAnomaly(
    job: LogAnalysisJob,
    {
      title,
      description,
      severity,
    }: Partial<Anomaly> & Pick<Anomaly, 'title' | 'severity' | 'description'>,
  ) {
    //check if the job has an anomaly
    //if yes then ignore
    //if not then add the anomaly to the job
    const existingAnomaly = await this.anomalyRepo.findOne({
      where: {
        logAnalysisJob: { id: job.id },
        status: In([AnomalyStatus.OPEN, AnomalyStatus.IN_PROGRESS]),
      },
    });
    if (existingAnomaly) return;

    const anomaly = this.anomalyRepo.create({
      logAnalysisJob: job,
      status: AnomalyStatus.OPEN,
      title,
      description,
      severity,
    });
    await this.anomalyRepo.save(anomaly);

    this.eventEmitter.emit(
      AnomalyCreatedEvent.name,
      new AnomalyCreatedEvent({
        ownerId: job.ownerId,
        jobId: job.id,
        anomalyId: anomaly.id,
      }),
    );
  }

  async listAnomalies(
    jobId: string,
    ownerId: string,
    { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResult<Anomaly>> {
    const [data, total] = await this.anomalyRepo.findAndCount({
      where: { logAnalysisJob: { id: jobId, ownerId } },
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, { page, limit });
  }

  getAnomalyForJob(jobId: string, anomalyId: string, ownerId: string) {
    return this.anomalyRepo.findOne({
      where: { id: anomalyId, logAnalysisJob: { id: jobId, ownerId } },
    });
  }

  async updateAnomalyStatus(
    jobId: string,
    anomalyId: string,
    ownerId: string,
    status: AnomalyStatus,
  ) {
    const anomaly = await this.getAnomalyForJob(jobId, anomalyId, ownerId);
    if (!anomaly) {
      throw new NotFoundException('Anomaly not found');
    }
    anomaly.status = status;
    return this.anomalyRepo.save(anomaly);
  }

  async setAnomalyTicketInfo(
    anomalyId: string,
    ownerId: string,
    ticketInfo: Record<string, any>,
  ) {
    const anomaly = await this.getAnomaly(anomalyId, ownerId);
    if (!anomaly) {
      throw new NotFoundException('Anomaly not found');
    }
    anomaly.ticketInfo = ticketInfo;
    return this.anomalyRepo.save(anomaly);
  }
}
