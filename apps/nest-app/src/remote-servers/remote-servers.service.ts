import { Injectable } from '@nestjs/common';
import { CreateRemoteServerDto } from './dto/create-remote-server.dto';
import { UpdateRemoteServerDto } from './dto/update-remote-server.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RemoteServer } from './entities/remote-server.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RemoteServersService {
  constructor(
    @InjectRepository(RemoteServer)
    private readonly remoteServerRepository: Repository<RemoteServer>,
  ) {}

  create(createRemoteServerDto: CreateRemoteServerDto) {
    return this.remoteServerRepository.save(createRemoteServerDto);
  }

  findAll() {
    return this.remoteServerRepository.find();
  }

  findOne(id: string) {
    return this.remoteServerRepository.findOneBy({ id });
  }

  update(id: string, updateRemoteServerDto: UpdateRemoteServerDto) {
    return this.remoteServerRepository.update(id, updateRemoteServerDto);
  }

  remove(id: string) {
    return this.remoteServerRepository.delete(id);
  }
}
