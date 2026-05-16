import { Test, TestingModule } from '@nestjs/testing';
import { RemoteServersController } from './remote-servers.controller';
import { RemoteServersService } from './remote-servers.service';
import { CreateRemoteServerDto } from './dto/create-remote-server.dto';
import { UpdateRemoteServerDto } from './dto/update-remote-server.dto';
import {
  RemoteServer,
  RemoteServerStatus,
} from './entities/remote-server.entity';

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

const mockService = {
  create: vi.fn(),
  findAll: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

describe('RemoteServersController', () => {
  let controller: RemoteServersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemoteServersController],
      providers: [{ provide: RemoteServersService, useValue: mockService }],
    }).compile();

    controller = module.get<RemoteServersController>(RemoteServersController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the dto and return result', async () => {
      const dto: CreateRemoteServerDto = {
        name: 'Test Server',
        config: { host: 'localhost', port: 22 },
      };
      mockService.create.mockResolvedValue(mockServer);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockServer);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll and return array of servers', async () => {
      mockService.findAll.mockResolvedValue([mockServer]);

      const result = await controller.findAll();

      expect(mockService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockServer]);
    });

    it('should return empty array when no servers exist', async () => {
      mockService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and return the server', async () => {
      mockService.findOne.mockResolvedValue(mockServer);

      const result = await controller.findOne('uuid-1');

      expect(mockService.findOne).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(mockServer);
    });

    it('should return null when server is not found', async () => {
      mockService.findOne.mockResolvedValue(null);

      const result = await controller.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const dto: UpdateRemoteServerDto = { name: 'Updated Server' };
      const updateResult = { affected: 1, raw: [], generatedMaps: [] };
      mockService.update.mockResolvedValue(updateResult);

      const result = await controller.update('uuid-1', dto);

      expect(mockService.update).toHaveBeenCalledWith('uuid-1', dto);
      expect(result).toEqual(updateResult);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id', async () => {
      const deleteResult = { affected: 1, raw: [] };
      mockService.remove.mockResolvedValue(deleteResult);

      const result = await controller.remove('uuid-1');

      expect(mockService.remove).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(deleteResult);
    });
  });
});
