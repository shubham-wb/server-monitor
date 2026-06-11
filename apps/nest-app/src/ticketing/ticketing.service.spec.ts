import { Test, TestingModule } from '@nestjs/testing';
import { vi, type Mocked } from 'vitest';
import { TicketingService } from './ticketing.service';
import { TicketingProviderFactory } from './ticketing-providers/ticketing-provider.factory';
import { AnomalyCreatedEvent } from '@/shared/events/anomaly.event';
import {
  Anomaly,
  AnomalySeverity,
  AnomalyStatus,
} from '@/log-analysis/log-analysis-jobs/entities/anomaly.entity';
import type { LogAnalysisJob } from '@/log-analysis/log-analysis-jobs/entities/log-analysis-job.entity';
import { LogAnalysisJobsService } from '@/log-analysis/log-analysis-jobs/log-analysis-jobs.service';
import { TicketSeverity, TicketStatus } from './ticketing.types';
import { ITicketingProvider } from './ticketing-providers/ticketing-provider.interface';

const PROVIDER_CONFIG = { type: 'ServiceNowTicketingProvider' };

const mockTicket = {
  id: 'ticket-123',
  title: 'Test Anomaly',
  description: 'An anomaly was detected',
  severity: TicketSeverity.HIGH,
  status: TicketStatus.OPEN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createTicketMock = vi.fn();
const getTicketMock = vi.fn();
const updateTicketMock = vi.fn();
const createProviderMock = vi.fn();

const mockProvider: Mocked<ITicketingProvider> = {
  createTicket: createTicketMock,
  getTicket: getTicketMock,
  updateTicket: updateTicketMock,
};

const mockTicketingProviderFactory = {
  create: createProviderMock,
};

const getTicketingSystemConfigMock = vi.fn();
const getAnomalyMock = vi.fn();

const mockLogAnalysisJobsService = {
  getTicketingSystemConfig: getTicketingSystemConfigMock,
  getAnomaly: getAnomalyMock,
};

function makeAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: 'anomaly-1',
    status: AnomalyStatus.OPEN,
    title: 'Test Anomaly',
    description: 'An anomaly was detected',
    severity: AnomalySeverity.HIGH,
    logAnalysisJob: null as unknown as LogAnalysisJob,
    ...overrides,
  };
}

const event = new AnomalyCreatedEvent({
  ownerId: 'owner-1',
  jobId: 'job-1',
  anomalyId: 'anomaly-1',
});

describe('TicketingService', () => {
  let service: TicketingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    createProviderMock.mockReturnValue(mockProvider);
    createTicketMock.mockResolvedValue(mockTicket);
    getTicketingSystemConfigMock.mockResolvedValue(PROVIDER_CONFIG);
    getAnomalyMock.mockResolvedValue(makeAnomaly());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketingService,
        {
          provide: TicketingProviderFactory,
          useValue: mockTicketingProviderFactory,
        },
        {
          provide: LogAnalysisJobsService,
          useValue: mockLogAnalysisJobsService,
        },
      ],
    }).compile();

    service = module.get<TicketingService>(TicketingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleAnomalyCreatedEvent', () => {
    it('creates a ticket via the provider when a provider type is configured', async () => {
      await service.handleAnomalyCreatedEvent(event);

      expect(getTicketingSystemConfigMock).toHaveBeenCalledWith('job-1');
      expect(getAnomalyMock).toHaveBeenCalledWith('anomaly-1', 'owner-1');
      expect(createProviderMock).toHaveBeenCalledWith(PROVIDER_CONFIG);
      expect(createTicketMock).toHaveBeenCalledWith({
        title: 'Test Anomaly',
        description: 'An anomaly was detected',
        severity: TicketSeverity.HIGH,
      });
    });

    it('returns early without creating a ticket when no config exists', async () => {
      getTicketingSystemConfigMock.mockResolvedValue(undefined);

      const result = await service.handleAnomalyCreatedEvent(event);

      expect(result).toBeUndefined();
      expect(createProviderMock).not.toHaveBeenCalled();
      expect(getAnomalyMock).not.toHaveBeenCalled();
      expect(createTicketMock).not.toHaveBeenCalled();
    });

    it('returns early when the config has no provider type', async () => {
      getTicketingSystemConfigMock.mockResolvedValue({ someOtherKey: 'value' });

      const result = await service.handleAnomalyCreatedEvent(event);

      expect(result).toBeUndefined();
      expect(createProviderMock).not.toHaveBeenCalled();
    });

    it('returns early without creating a ticket when the anomaly is not found', async () => {
      getAnomalyMock.mockResolvedValue(null);

      const result = await service.handleAnomalyCreatedEvent(event);

      expect(result).toBeUndefined();
      expect(createTicketMock).not.toHaveBeenCalled();
    });

    it.each([AnomalyStatus.IN_PROGRESS, AnomalyStatus.CLOSED])(
      'returns early without creating a ticket when the anomaly status is %s',
      async (status) => {
        getAnomalyMock.mockResolvedValue(makeAnomaly({ status }));

        const result = await service.handleAnomalyCreatedEvent(event);

        expect(result).toBeUndefined();
        expect(createTicketMock).not.toHaveBeenCalled();
      },
    );

    it('maps LOW anomaly severity to LOW ticket severity', async () => {
      getAnomalyMock.mockResolvedValue(
        makeAnomaly({ severity: AnomalySeverity.LOW }),
      );

      await service.handleAnomalyCreatedEvent(event);

      expect(createTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: TicketSeverity.LOW }),
      );
    });

    it('maps MEDIUM anomaly severity to MEDIUM ticket severity', async () => {
      getAnomalyMock.mockResolvedValue(
        makeAnomaly({ severity: AnomalySeverity.MEDIUM }),
      );

      await service.handleAnomalyCreatedEvent(event);

      expect(createTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({ severity: TicketSeverity.MEDIUM }),
      );
    });

    it('forwards anomaly title and description to createTicket', async () => {
      getAnomalyMock.mockResolvedValue(
        makeAnomaly({ title: 'Disk full', description: 'Disk usage > 95%' }),
      );

      await service.handleAnomalyCreatedEvent(event);

      expect(createTicketMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Disk full',
          description: 'Disk usage > 95%',
        }),
      );
    });

    it('returns the ticket created by the provider', async () => {
      const result = await service.handleAnomalyCreatedEvent(event);

      expect(result).toEqual(mockTicket);
    });
  });
});
