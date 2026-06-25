import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemoteServersModule } from './remote-servers/remote-servers.module';
import { AuthModule } from './auth/auth.module';
import { LogSourcesModule } from './log-sources/log-sources.module';
import { LogAnalysisModule } from './log-analysis/log-analysis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TicketingModule } from './ticketing/ticketing.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? 'db.sqlite',
      autoLoadEntities: true,
      // MVP choice: auto-create the schema from entities on boot. Convenient for
      // a single-tenant SQLite dev/demo deploy, but it can drop/alter columns on
      // entity changes. Migrations are a post-MVP concern (see MVP_PLAN.md M2.3).
      // Before any multi-instance / data-bearing deploy, set this to false and
      // generate migrations.
      synchronize: true,
    }),
    UsersModule,
    RemoteServersModule,
    AuthModule,
    LogSourcesModule,
    LogAnalysisModule,
    EventEmitterModule.forRoot(),
    TicketingModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
