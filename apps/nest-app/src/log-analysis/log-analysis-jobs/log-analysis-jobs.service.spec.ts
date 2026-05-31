import {
  LogSource,
  LogSourceStatus,
  LogSourceType,
} from '@/log-sources/entities/log-source.entity';
import { LogSourcesService } from '@/log-sources/log-sources.service';
import {
  RemoteServer,
  RemoteServerStatus,
} from '@/remote-servers/entities/remote-server.entity';
import { RemoteServersService } from '@/remote-servers/remote-servers.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateLogAnalysisJobDto } from './dto/create-log-analysis-job.dto';
import { UpdateLogAnalysisJobDto } from './dto/update-log-analysis-job.dto';
import {
  LogAnalysisJob,
  LogAnalysisJobStatus,
  LogAnalysisJobType,
} from './entities/log-analysis-job.entity';
import { LogAnalysisJobsService } from './log-analysis-jobs.service';
import { Anomaly } from './entities/anomaly.entity';
import { Repository } from 'typeorm';

const OWNER_ID = 'owner-1';

const mockLogSource: LogSource = {
  id: 'log-source-1',
  ownerId: OWNER_ID,
  name: 'Test Log Source',
  description: 'A test log source',
  status: LogSourceStatus.ONLINE,
  type: LogSourceType.ZABBIX,
  config: { url: 'http://zabbix.local' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRemoteServer: RemoteServer = {
  id: 'remote-server-1',
  name: 'Test Server',
  ownerId: OWNER_ID,
  description: 'A test server',
  config: { host: 'localhost', port: 22 },
  status: RemoteServerStatus.ONLINE,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockJob: LogAnalysisJob = {
  id: 'uuid-1',
  ownerId: OWNER_ID,
  name: 'Test Job',
  description: 'A test job',
  status: LogAnalysisJobStatus.INITIALIZED,
  type: LogAnalysisJobType.ONE_TIME,
  logSource: mockLogSource,
  remoteServer: mockRemoteServer,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRepository = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOneBy: vi.fn(),
  delete: vi.fn(),
};

const mockLogSourcesService = {
  findOne: vi.fn(),
};

const mockRemoteServersService = {
  getById: vi.fn(),
};

describe('LogAnalysisJobsService', () => {
  let service: LogAnalysisJobsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogAnalysisJobsService,
        {
          provide: getRepositoryToken(LogAnalysisJob),
          useValue: mockRepository,
        },
        {
          provide: LogSourcesService,
          useValue: mockLogSourcesService,
        },
        {
          provide: RemoteServersService,
          useValue: mockRemoteServersService,
        },
        {
          provide: getRepositoryToken(Anomaly),
          useValue: mock<Repository<Anomaly>>(),
        },
      ],
    }).compile();

    service = module.get<LogAnalysisJobsService>(LogAnalysisJobsService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should fetch dependencies, create, and save a job with INITIALIZED status', async () => {
      const dto: CreateLogAnalysisJobDto = {
        name: 'Test Job',
        type: LogAnalysisJobType.ONE_TIME,
        ticketingSystemConfig: {
          apiKey: 'api-key',
        },
        description: 'test description',
        logSourceId: 'log-source-1',
        remoteServerId: 'remote-server-1',
      };
      const entity = {
        ...dto,
        ownerId: OWNER_ID,
        status: LogAnalysisJobStatus.INITIALIZED,
        logSource: mockLogSource,
        remoteServer: mockRemoteServer,
      };
      mockRemoteServersService.getById.mockResolvedValue(mockRemoteServer);
      mockLogSourcesService.findOne.mockResolvedValue(mockLogSource);
      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue(mockJob);

      const result = await service.create(dto, OWNER_ID);

      expect(mockRemoteServersService.getById).toHaveBeenCalledWith(
        'remote-server-1',
        OWNER_ID,
      );
      expect(mockLogSourcesService.findOne).toHaveBeenCalledWith(
        'log-source-1',
        OWNER_ID,
      );
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        ownerId: OWNER_ID,
        status: LogAnalysisJobStatus.INITIALIZED,
        logSource: mockLogSource,
        remoteServer: mockRemoteServer,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(mockJob);
    });

    it('should create a job without a log source when logSourceId is not provided', async () => {
      const dto = {
        name: 'Test Job',
        type: LogAnalysisJobType.ONE_TIME,
        remoteServerId: 'remote-server-1',
      } as CreateLogAnalysisJobDto;
      const entity = {
        ...dto,
        ownerId: OWNER_ID,
        status: LogAnalysisJobStatus.INITIALIZED,
        logSource: undefined,
        remoteServer: mockRemoteServer,
      };
      mockRemoteServersService.getById.mockResolvedValue(mockRemoteServer);
      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue({
        ...mockJob,
        logSource: undefined,
      });

      await service.create(dto, OWNER_ID);

      expect(mockLogSourcesService.findOne).not.toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        ownerId: OWNER_ID,
        status: LogAnalysisJobStatus.INITIALIZED,
        logSource: undefined,
        remoteServer: mockRemoteServer,
      });
    });

    it('should throw BadRequestException when remote server is not found', async () => {
      const dto = {
        name: 'Test Job',
        type: LogAnalysisJobType.ONE_TIME,
        remoteServerId: 'non-existent',
      } as CreateLogAnalysisJobDto;
      mockRemoteServersService.getById.mockRejectedValue(
        new BadRequestException('Remote server not found'),
      );

      await expect(service.create(dto, OWNER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all jobs for the owner', async () => {
      mockRepository.find.mockResolvedValue([mockJob]);

      const result = await service.findAll(OWNER_ID);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerId: OWNER_ID },
      });
      expect(result).toEqual([mockJob]);
    });

    it('should return an empty array when owner has no jobs', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll(OWNER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a job matching id and ownerId', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockJob);

      const result = await service.findOne('uuid-1', OWNER_ID);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 'uuid-1',
        ownerId: OWNER_ID,
      });
      expect(result).toEqual(mockJob);
    });

    it('should return null when not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('non-existent', OWNER_ID);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return the job', async () => {
      const dto: UpdateLogAnalysisJobDto = { name: 'Updated Job' };
      const updated = { ...mockJob, ...dto };
      mockRepository.findOneBy.mockResolvedValue(mockJob);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto, OWNER_ID);

      expect(mockRepository.save).toHaveBeenCalledWith({ ...mockJob, ...dto });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'x' }, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete the job by id and ownerId and return the result', async () => {
      const deleteResult = { affected: 1, raw: [] };
      mockRepository.findOneBy.mockResolvedValue(mockJob);
      mockRepository.delete.mockResolvedValue(deleteResult);

      const result = await service.remove('uuid-1', OWNER_ID);

      expect(mockRepository.delete).toHaveBeenCalledWith({
        id: 'uuid-1',
        ownerId: OWNER_ID,
      });
      expect(result).toEqual(deleteResult);
    });

    it('should throw NotFoundException when job does not exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('non-existent', OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
