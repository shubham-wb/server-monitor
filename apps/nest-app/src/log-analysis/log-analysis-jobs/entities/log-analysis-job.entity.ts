import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LogSource } from '../../../log-sources/entities/log-source.entity';
import { RemoteServer } from '../../../remote-servers/entities/remote-server.entity';
import { Anomaly } from './anomaly.entity';

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

  @Column({ type: 'simple-enum', enum: LogAnalysisJobStatus })
  status: LogAnalysisJobStatus;

  @Column({ type: 'simple-enum', enum: LogAnalysisJobType })
  type!: LogAnalysisJobType;

  @Column({ type: 'simple-json', nullable: true })
  ticketingSystemConfig?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LogSource, { nullable: true })
  @JoinColumn()
  logSource: LogSource;

  @ManyToOne(() => RemoteServer)
  @JoinColumn()
  remoteServer!: RemoteServer;

  @OneToMany(() => Anomaly, (anomaly) => anomaly.logAnalysisJob)
  anomalies: Anomaly[];
}
