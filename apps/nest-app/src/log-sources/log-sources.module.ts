import { Module } from '@nestjs/common';
import { LogSourcesService } from './log-sources.service';
import { LogSourcesController } from './log-sources.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogSource } from './entities/log-source.entity';
import { RemoteServersModule } from '../remote-servers/remote-servers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LogSource]),
    LogSourcesModule,
    RemoteServersModule,
  ],
  controllers: [LogSourcesController],
  providers: [LogSourcesService],
  exports: [LogSourcesService],
})
export class LogSourcesModule {}
