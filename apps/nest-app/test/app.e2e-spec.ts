import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from '@/database/database.module';
import { DatabaseTestModule } from '@/database/database-test.module';

describe('AppController (e2e)', () => {
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
    // Reset the database so each test starts from a clean schema.
    if (dataSource.isInitialized) {
      await dataSource.dropDatabase();
      await dataSource.synchronize(true);
    }
    await app.close();
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });
});
