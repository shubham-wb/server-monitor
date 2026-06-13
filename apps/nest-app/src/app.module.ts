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
      database: 'db.sqlite',
      autoLoadEntities: true,
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
