import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  const API_KEY = process.env.API_KEY as string;
  const INGEST_KEY = process.env.INGEST_KEY as string;
  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(DatabaseTestModule)
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts so pagination DTO defaults (page/limit) and query coercion
    // apply — without this, `@Query() PaginationQueryDto` stays uncoerced and
    // `skip`/`take` come through undefined.
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
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
        .set('Authorization', `Bearer ${API_KEY}`)
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

      // create the job  (operator key)
      const logAnalysisJobResponse = await request(app.getHttpServer())
        .post('/log-analysis-jobs')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send(createLogAnalysisJobDto)
        .expect(201);

      const jobId = (logAnalysisJobResponse.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .set('Authorization', `Bearer ${INGEST_KEY}`)
        .send([{ message: 'test-error-log', level: 'error' }])
        .expect(200);

      // first ingest flips the job to `running` (M2.1)
      const jobAfterIngest = await request(app.getHttpServer())
        .get(`/log-analysis-jobs/${jobId}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);
      expect((jobAfterIngest.body as { status: string }).status).toBe('running');

      // Ticket creation runs in an async AnomalyCreated event listener that the
      // ingest request does not await, so poll until the ticket is persisted.
      let tickets: Array<{ id: string; title: string; description: string }> =
        [];
      await vi.waitFor(
        async () => {
          const res = await request(app.getHttpServer())
            .get('/tickets')
            .set('Authorization', `Bearer ${API_KEY}`)
            .expect(200);
          tickets = res.body.data;
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
          .set('Authorization', `Bearer ${API_KEY}`)
          .expect(200)
      ).body.data as Array<{ id: string }>;

      expect(anomalies).toHaveLength(1);

      await request(app.getHttpServer())
        .patch(`/log-analysis-jobs/${jobId}/anomalies/${anomalies[0].id}`)
        .set('Authorization', `Bearer ${API_KEY}`)
        .send({ status: 'closed' })
        .expect(200);

      // a second error now raises a fresh anomaly + ticket
      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .set('Authorization', `Bearer ${INGEST_KEY}`)
        .send([{ message: 'second-error-log', level: 'error' }])
        .expect(200);

      await vi.waitFor(
        async () => {
          const res = await request(app.getHttpServer())
            .get('/tickets')
            .set('Authorization', `Bearer ${API_KEY}`)
            .expect(200);
          expect(res.body.data).toHaveLength(2); // gate reopened → fresh ticket
        },
        { timeout: 5000 },
      );
    });
  });
});
