import { Test, TestingModule } from '@nestjs/testing';
import { LogAnalysisController } from './log-analysis.controller';
import { LogAnalysisService } from './log-analysis.service';

const mockLogAnalysisService = {
  ingestLogs: vi.fn(),
};

describe('LogAnalysisController', () => {
  let controller: LogAnalysisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogAnalysisController],
      providers: [
        { provide: LogAnalysisService, useValue: mockLogAnalysisService },
      ],
    }).compile();

    controller = module.get<LogAnalysisController>(LogAnalysisController);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
