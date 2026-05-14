import { Test, TestingModule } from '@nestjs/testing';
import { RemoteServersService } from './remote-servers.service';

describe('RemoteServersService', () => {
  let service: RemoteServersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RemoteServersService],
    }).compile();

    service = module.get<RemoteServersService>(RemoteServersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
