import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import request from 'supertest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { AppModule } from '../src/app.module';
import { resetDatabase } from './test-utils';
import { DatabaseTestModule } from '@/database/database-test.module';
import { DatabaseModule } from '@/database/database.module';
import { CreateRemoteServerDto } from '@/remote-servers/dto/create-remote-server.dto';
import { CreateLogAnalysisJobDto } from '@/log-analysis/log-analysis-jobs/dto/create-log-analysis-job.dto';
import { LogAnalysisJobType } from '@/log-analysis/log-analysis-jobs/entities/log-analysis-job.entity';
import { TicketingProviderFactory } from '@/ticketing/ticketing-providers/ticketing-provider.factory';
import { ITicketingProvider } from '@/ticketing/ticketing-providers/ticketing-provider.interface';

describe('Ticket Creation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let moduleFixture: TestingModule;
  let ticketingProviderFactory: MockProxy<TicketingProviderFactory>;
  let ticketProvider: MockProxy<ITicketingProvider>;

  beforeEach(async () => {
    ticketingProviderFactory = mock<TicketingProviderFactory>();
    ticketProvider = mock<ITicketingProvider>();
    ticketingProviderFactory.create.mockReturnValue(
      ticketProvider as unknown as ReturnType<
        TicketingProviderFactory['create']
      >,
    );

    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(DatabaseTestModule)
      .overrideProvider(TicketingProviderFactory)
      .useValue(ticketingProviderFactory)
      .compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
    await app.close();
  });

  describe('ticket creation', () => {
    it('should create a ticket', async () => {
      // create a remote server
      const createRemoteServerDto: CreateRemoteServerDto = {
        name: 'test-remote-server',
        config: {
          url: 'https://test-remote-server.com',
        },
      };

      const remoteServerResponse = await request(app.getHttpServer())
        .post('/remote-servers')
        .send(createRemoteServerDto)
        .expect(201);

      const remoteServerId = (remoteServerResponse.body as { id: string }).id;

      // create a job with a ticketing system configured so anomalies raise
      // tickets (the listener bails out early when no provider is configured)
      const createLogAnalysisJobDto: CreateLogAnalysisJobDto = {
        name: 'test-log-analysis-job',
        type: LogAnalysisJobType.RECURRING,
        description: 'test-log-analysis-job-description',
        remoteServerId,
        ticketingSystemConfig: { type: 'ServiceNowTicketingProvider' },
      };

      const logAnalysisJobResponse = await request(app.getHttpServer())
        .post('/log-analysis-jobs')
        .send(createLogAnalysisJobDto)
        .expect(201);

      const jobId = (logAnalysisJobResponse.body as { id: string }).id;

      // send error logs to the job
      const errorLogs = [
        {
          message: 'test-error-log',
          level: 'error',
        },
      ];

      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .send(errorLogs)
        .expect(200);

      // Ticket creation runs in an async AnomalyCreated event listener that the
      // ingest request does not await, so poll until the provider is invoked.
      await vi.waitFor(
        () => {
          expect(ticketProvider.createTicket.mock.calls).toHaveLength(1);
        },
        { timeout: 5000 },
      );

      expect(ticketProvider.createTicket.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          title: expect.stringContaining('test-error-log'),
          description: expect.stringContaining('test-error-log'),
        }),
      );
    });
  });
});
