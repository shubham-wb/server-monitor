import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from '@/database/database.module';
import { DatabaseTestModule } from '@/database/database-test.module';
import { OPERATOR_USER } from '@/auth/auth.constants';
import { resetDatabase } from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let moduleFixture: TestingModule;

  const API_KEY = process.env.API_KEY as string;

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

  describe('GET /auth/me', () => {
    it('returns 401 without a key', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 401 with an invalid key', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer wrong-key')
        .expect(401);
    });

    it('returns the operator user with a valid key', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);

      expect(response.body).toEqual(OPERATOR_USER);
    });
  });
});
