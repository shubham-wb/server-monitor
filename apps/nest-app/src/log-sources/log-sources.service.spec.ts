import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LogSourcesService } from './log-sources.service';
import {
  LogSource,
  LogSourceStatus,
  LogSourceType,
} from './entities/log-source.entity';
import { CreateLogSourceDto } from './dto/create-log-source.dto';
import { UpdateLogSourceDto } from './dto/update-log-source.dto';

const OWNER_ID = 'owner-1';

const mockLogSource: LogSource = {
  id: 'uuid-1',
  ownerId: OWNER_ID,
  name: 'Test Source',
  description: 'A test log source',
  status: LogSourceStatus.ONLINE,
  type: LogSourceType.ZABBIX,
  config: { url: 'http://zabbix.local' },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRepository = {
  create: vi.fn(),
  save: vi.fn(),
  find: vi.fn(),
  findOneBy: vi.fn(),
  remove: vi.fn(),
};

describe('LogSourcesService', () => {
  let service: LogSourcesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogSourcesService,
        {
          provide: getRepositoryToken(LogSource),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LogSourcesService>(LogSourcesService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a log source with UNKNOWN status', async () => {
      const dto: CreateLogSourceDto = {
        name: 'Test Source',
        type: LogSourceType.ZABBIX,
        config: { url: 'http://zabbix.local' },
      };
      const entity = {
        ...dto,
        ownerId: OWNER_ID,
        status: LogSourceStatus.UNKNOWN,
      };
      mockRepository.create.mockReturnValue(entity);
      mockRepository.save.mockResolvedValue(mockLogSource);

      const result = await service.create(dto, OWNER_ID);

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        ownerId: OWNER_ID,
        status: LogSourceStatus.UNKNOWN,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(entity);
      expect(result).toEqual(mockLogSource);
    });
  });

  describe('findAll', () => {
    it('should return all log sources for the owner', async () => {
      mockRepository.find.mockResolvedValue([mockLogSource]);

      const result = await service.findAll(OWNER_ID);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { ownerId: OWNER_ID },
      });
      expect(result).toEqual([mockLogSource]);
    });

    it('should return an empty array when owner has no log sources', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll(OWNER_ID);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a log source matching id and ownerId', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockLogSource);

      const result = await service.findOne('uuid-1', OWNER_ID);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 'uuid-1',
        ownerId: OWNER_ID,
      });
      expect(result).toEqual(mockLogSource);
    });

    it('should return null when not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('non-existent', OWNER_ID);

      expect(result).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return the log source when found', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockLogSource);

      const result = await service.getById('uuid-1', OWNER_ID);

      expect(result).toEqual(mockLogSource);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getById('non-existent', OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the log source', async () => {
      const dto: UpdateLogSourceDto = { name: 'Updated Source' };
      const updated = { ...mockLogSource, ...dto };
      mockRepository.findOneBy.mockResolvedValue(mockLogSource);
      mockRepository.save.mockResolvedValue(updated);

      const result = await service.update('uuid-1', dto, OWNER_ID);

      expect(mockRepository.save).toHaveBeenCalledWith({
        ...mockLogSource,
        ...dto,
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when log source does not exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'x' }, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove and return the log source', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockLogSource);
      mockRepository.remove.mockResolvedValue(mockLogSource);

      const result = await service.remove('uuid-1', OWNER_ID);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockLogSource);
      expect(result).toEqual(mockLogSource);
    });

    it('should throw NotFoundException when log source does not exist', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('non-existent', OWNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
