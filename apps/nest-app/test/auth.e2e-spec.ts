import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from '@/database/database.module';
import { DatabaseTestModule } from '@/database/database-test.module';
import { resetDatabase } from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let moduleFixture: TestingModule;

  // The AuthGuard currently injects this default user on every request.
  // Bearer-token / API-key parsing is still a TODO in the guard.
  const DEFAULT_USER = {
    id: 'default-user-1',
    name: 'Default User 1',
    email: 'default-user-1@example.com',
  };

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
    // Reset the database so each test starts from a clean schema.
    await resetDatabase(dataSource);
    await app.close();
  });

  describe('GET /auth/me', () => {
    it('returns the current authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(200);

      expect(response.body).toEqual(DEFAULT_USER);
    });

    it('resolves a user even without an Authorization header', async () => {
      // The guard authenticates every request for now, so the endpoint is
      // reachable without credentials.
      const response = await request(app.getHttpServer()).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(DEFAULT_USER);
    });

    it('ignores a provided bearer token and still returns the default user', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer some-token')
        .expect(200);

      expect(response.body).toEqual(DEFAULT_USER);
    });
  });
});
