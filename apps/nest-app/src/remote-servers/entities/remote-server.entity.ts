import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RemoteServerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  UNKNOWN = 'unknown',
}

@Entity()
export class RemoteServer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  ownerId: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'simple-json' })
  config: Record<string, any>;

  @Column({ type: 'simple-enum', enum: RemoteServerStatus })
  status: RemoteServerStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
