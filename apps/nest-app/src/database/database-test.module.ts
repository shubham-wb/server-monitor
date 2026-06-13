import { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

export class DatabaseTestModule {
  static forRoot(): DynamicModule {
    return {
      module: DatabaseTestModule,
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        }),
      ],
    };
  }
}
