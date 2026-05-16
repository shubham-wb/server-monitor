import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RemoteServersService } from './remote-servers.service';
import {
  RemoteServer,
  RemoteServerStatus,
} from './entities/remote-server.entity';
import { CreateRemoteServerDto } from './dto/create-remote-server.dto';
import { UpdateRemoteServerDto } from './dto/update-remote-server.dto';

const mockServer: RemoteServer = {
  id: 'uuid-1',
  name: 'Test Server',
  ownerId: 'owner-1',
  description: 'A test server',
  config: { host: 'localhost', port: 22 },
  status: RemoteServerStatus.ONLINE,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRepository = {
  save: vi.fn(),
  find: vi.fn(),
  findOneBy: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('RemoteServersService', () => {
  let service: RemoteServersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteServersService,
        {
          provide: getRepositoryToken(RemoteServer),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RemoteServersService>(RemoteServersService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should save and return a new server', async () => {
      const dto: CreateRemoteServerDto = {
        name: 'Test Server',
        config: { host: 'localhost', port: 22 },
      };
      mockRepository.save.mockResolvedValue(mockServer);

      const result = await service.create(dto);

      expect(mockRepository.save).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockServer);
    });
  });

  describe('findAll', () => {
    it('should return all servers', async () => {
      mockRepository.find.mockResolvedValue([mockServer]);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalled();
      expect(result).toEqual([mockServer]);
    });

    it('should return empty array when no servers exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a server by id', async () => {
      mockRepository.findOneBy.mockResolvedValue(mockServer);

      const result = await service.findOne('uuid-1');

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 'uuid-1' });
      expect(result).toEqual(mockServer);
    });

    it('should return null when server is not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a server by id and return update result', async () => {
      const dto: UpdateRemoteServerDto = { name: 'Updated Server' };
      const updateResult = { affected: 1, raw: [], generatedMaps: [] };
      mockRepository.update.mockResolvedValue(updateResult);

      const result = await service.update('uuid-1', dto);

      expect(mockRepository.update).toHaveBeenCalledWith('uuid-1', dto);
      expect(result).toEqual(updateResult);
    });

    it('should return affected 0 when server does not exist', async () => {
      const dto: UpdateRemoteServerDto = { name: 'Updated Server' };
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: [],
        generatedMaps: [],
      });

      const result = await service.update('non-existent-id', dto);

      expect(result).toMatchObject({ affected: 0 });
    });
  });

  describe('remove', () => {
    it('should delete a server by id and return delete result', async () => {
      const deleteResult = { affected: 1, raw: [] };
      mockRepository.delete.mockResolvedValue(deleteResult);

      const result = await service.remove('uuid-1');

      expect(mockRepository.delete).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(deleteResult);
    });

    it('should return affected 0 when server does not exist', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      const result = await service.remove('non-existent-id');

      expect(result).toMatchObject({ affected: 0 });
    });
  });
});
