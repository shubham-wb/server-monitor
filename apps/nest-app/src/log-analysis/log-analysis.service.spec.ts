import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LogAnalysisService } from './log-analysis.service';
import { LogAnalysisJobsService } from './log-analysis-jobs/log-analysis-jobs.service';
import { AnomalySeverity } from './log-analysis-jobs/entities/anomaly.entity';
import { LogAnalysisJob } from './log-analysis-jobs/entities/log-analysis-job.entity';

const mockJob = { id: 'job-1', ownerId: 'owner-1' } as LogAnalysisJob;

const mockLogAnalysisJobsService = {
  findOne: vi.fn(),
  addAnomaly: vi.fn(),
};

describe('LogAnalysisService', () => {
  let service: LogAnalysisService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogAnalysisService,
        { provide: LogAnalysisJobsService, useValue: mockLogAnalysisJobsService },
      ],
    }).compile();

    service = module.get<LogAnalysisService>(LogAnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingestLogs', () => {
    it('throws NotFoundException when job is not found', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(null);

      await expect(
        service.ingestLogs('missing-job', 'owner-1', [{ message: 'test', level: 'error' }]),
      ).rejects.toThrow(NotFoundException);

      expect(mockLogAnalysisJobsService.findOne).toHaveBeenCalledWith('missing-job', 'owner-1');
      expect(mockLogAnalysisJobsService.addAnomaly).not.toHaveBeenCalled();
    });

    it('calls addAnomaly once for each log entry', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      const logs = [
        { message: 'First error', level: 'error' },
        { message: 'Second error', level: 'warning' },
        { message: 'Critical issue', level: 'critical' },
      ];

      await service.ingestLogs('job-1', 'owner-1', logs);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledTimes(3);
    });

    it('maps critical level to HIGH severity', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [{ message: 'Disk full', level: 'critical' }]);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledWith(mockJob, {
        title: 'Disk full',
        description: 'Disk full',
        severity: AnomalySeverity.HIGH,
      });
    });

    it('maps non-critical level to MEDIUM severity', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [{ message: 'High memory', level: 'error' }]);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledWith(mockJob, {
        title: 'High memory',
        description: 'High memory',
        severity: AnomalySeverity.MEDIUM,
      });
    });

    it('uses fallback title when message is absent', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [{ level: 'error' }]);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledWith(mockJob, {
        title: 'Untitled Log Message',
        description: 'Untitled Log Message',
        severity: AnomalySeverity.MEDIUM,
      });
    });

    it('uses fallback severity (MEDIUM) when level is absent', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [{ message: 'Something happened' }]);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledWith(mockJob, {
        title: 'Something happened',
        description: 'Something happened',
        severity: AnomalySeverity.MEDIUM,
      });
    });

    it('does not call addAnomaly when logs array is empty', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);

      await service.ingestLogs('job-1', 'owner-1', []);

      expect(mockLogAnalysisJobsService.addAnomaly).not.toHaveBeenCalled();
    });

    it('calls addAnomaly with the resolved job object', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [{ message: 'test', level: 'error' }]);

      expect(mockLogAnalysisJobsService.addAnomaly).toHaveBeenCalledWith(
        mockJob,
        expect.objectContaining({ title: 'test' }),
      );
    });
  });
});
