import { Module } from '@nestjs/common';
import { RemoteServersService } from './remote-servers.service';
import { RemoteServersController } from './remote-servers.controller';

@Module({
  controllers: [RemoteServersController],
  providers: [RemoteServersService],
})
export class RemoteServersModule {}
