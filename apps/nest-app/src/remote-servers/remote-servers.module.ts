import { Module } from '@nestjs/common';
import { RemoteServersService } from './remote-servers.service';
import { RemoteServersController } from './remote-servers.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemoteServer } from './entities/remote-server.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RemoteServer])],
  controllers: [RemoteServersController],
  providers: [RemoteServersService],
})
export class RemoteServersModule {}
