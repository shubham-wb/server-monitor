import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { resetDatabase } from './test-utils';
import { DatabaseTestModule } from '@/database/database-test.module';
import { DatabaseModule } from '@/database/database.module';
import { CreateRemoteServerDto } from '@/remote-servers/dto/create-remote-server.dto';
import { CreateLogAnalysisJobDto } from '@/log-analysis/log-analysis-jobs/dto/create-log-analysis-job.dto';
import { LogAnalysisJobType } from '@/log-analysis/log-analysis-jobs/entities/log-analysis-job.entity';

describe('Ticket Creation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(DatabaseTestModule)
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
    it('should persist a ticket and reopen the loop after the anomaly is closed', async () => {
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

      // create a job pointed at the real internal ticketing provider so
      // anomalies raise persisted tickets (the listener bails out early when
      // no provider is configured)
      const createLogAnalysisJobDto: CreateLogAnalysisJobDto = {
        name: 'test-log-analysis-job',
        type: LogAnalysisJobType.RECURRING,
        description: 'test-log-analysis-job-description',
        remoteServerId,
        ticketingSystemConfig: { type: 'InternalTicketingProvider' },
      };

      const logAnalysisJobResponse = await request(app.getHttpServer())
        .post('/log-analysis-jobs')
        .send(createLogAnalysisJobDto)
        .expect(201);

      const jobId = (logAnalysisJobResponse.body as { id: string }).id;

      // send an error log to the job
      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .send([{ message: 'test-error-log', level: 'error' }])
        .expect(200);

      // Ticket creation runs in an async AnomalyCreated event listener that the
      // ingest request does not await, so poll until the ticket is persisted.
      let tickets: Array<{ id: string; title: string; description: string }> =
        [];
      await vi.waitFor(
        async () => {
          const res = await request(app.getHttpServer())
            .get('/tickets')
            .expect(200);
          tickets = res.body;
          expect(tickets).toHaveLength(1);
        },
        { timeout: 5000 },
      );

      // the persisted ticket carries the anomaly's title/description
      expect(tickets[0]).toEqual(
        expect.objectContaining({
          title: expect.stringContaining('test-error-log'),
          description: expect.stringContaining('test-error-log'),
        }),
      );

      // close the open anomaly so the dedupe gate reopens
      const anomalies = (
        await request(app.getHttpServer())
          .get(`/log-analysis-jobs/${jobId}/anomalies`)
          .expect(200)
      ).body as Array<{ id: string }>;

      expect(anomalies).toHaveLength(1);

      await request(app.getHttpServer())
        .patch(`/log-analysis-jobs/${jobId}/anomalies/${anomalies[0].id}`)
        .send({ status: 'closed' })
        .expect(200);

      // a second error now raises a fresh anomaly + ticket
      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .send([{ message: 'second-error-log', level: 'error' }])
        .expect(200);

      await vi.waitFor(
        async () => {
          const res = await request(app.getHttpServer())
            .get('/tickets')
            .expect(200);
          expect(res.body).toHaveLength(2); // gate reopened → fresh ticket
        },
        { timeout: 5000 },
      );
    });
  });
});
