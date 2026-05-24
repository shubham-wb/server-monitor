import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  CreateDateColumn,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { LogSource } from '../../../log-sources/entities/log-source.entity';
import { RemoteServer } from '../../../remote-servers/entities/remote-server.entity';

export enum LogAnalysisJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  INITIALIZED = 'initialized',
  FAILED = 'failed',
}
export enum LogAnalysisJobType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
}

@Entity()
export class LogAnalysisJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: LogAnalysisJobStatus })
  status: LogAnalysisJobStatus;

  @Column({ type: 'enum', enum: LogAnalysisJobType })
  type!: LogAnalysisJobType;

  @Column({ type: 'simple-json', nullable: true })
  ticketingSystemConfig?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => LogSource, { nullable: true })
  @JoinColumn()
  logSource: LogSource;

  @OneToOne(() => RemoteServer)
  @JoinColumn()
  remoteServer!: RemoteServer;
}
