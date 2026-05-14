import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service = mock<UsersService>();
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mock<UsersService>(),
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<Mocked<UsersService>>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a user', async () => {
    const user = { id: '1', name: 'test', email: 'test@test.com' };
    service.create.mockResolvedValue(user);

    const createUserDto = { name: 'test', email: 'test@test.com' };

    const result = await controller.create(createUserDto);
    expect(service.create.mock.calls).toHaveLength(1);
    expect(service.create.mock.calls[0][0]).toEqual(createUserDto);
    expect(result).toBe(user);
  });

  it('should return all users', async () => {
    const users = [
      { id: '1', name: 'Alice', email: 'alice@test.com' },
      { id: '2', name: 'Bob', email: 'bob@test.com' },
    ];
    service.findAll.mockResolvedValue(users);

    const result = await controller.findAll();
    expect(service.findAll.mock.calls).toHaveLength(1);
    expect(result).toBe(users);
  });

  it('should return a single user by id', async () => {
    const user = { id: '1', name: 'Alice', email: 'alice@test.com' };
    service.findOne.mockResolvedValue(user);

    const result = await controller.findOne('1');
    expect(service.findOne.mock.calls).toHaveLength(1);
    expect(service.findOne.mock.calls[0][0]).toBe('1');
    expect(result).toBe(user);
  });

  it('should update a user', async () => {
    const updateResult = { generatedMaps: [], raw: [], affected: 1 };
    service.update.mockResolvedValue(updateResult);

    const updateUserDto = { name: 'Updated Name' };

    const result = await controller.update('1', updateUserDto);
    expect(service.update.mock.calls).toHaveLength(1);
    expect(service.update.mock.calls[0][0]).toBe('1');
    expect(service.update.mock.calls[0][1]).toEqual(updateUserDto);
    expect(result).toBe(updateResult);
  });
});
