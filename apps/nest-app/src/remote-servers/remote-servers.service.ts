import { Injectable } from '@nestjs/common';
import { CreateRemoteServerDto } from './dto/create-remote-server.dto';
import { UpdateRemoteServerDto } from './dto/update-remote-server.dto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  RemoteServer,
  RemoteServerStatus,
} from './entities/remote-server.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RemoteServersService {
  constructor(
    @InjectRepository(RemoteServer)
    private readonly repo: Repository<RemoteServer>,
  ) {}

  create(props: CreateRemoteServerDto & { ownerId: string }) {
    const remoteServer = this.repo.create({
      ...props,
      status: RemoteServerStatus.UNKNOWN,
    });

    return this.repo.save(remoteServer);
  }

  findAll(ownerId: string) {
    return this.repo.find({ where: { ownerId } });
  }

  findOne(id: string) {
    return this.repo.findOneBy({ id });
  }

  update(id: string, updateRemoteServerDto: UpdateRemoteServerDto) {
    return this.repo.update(id, updateRemoteServerDto);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
}
