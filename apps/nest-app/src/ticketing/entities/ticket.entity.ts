import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TicketSeverity, TicketStatus } from '../ticketing.types';
import { Anomaly } from '@/log-analysis/log-analysis-jobs/entities/anomaly.entity';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ type: 'simple-enum', enum: TicketSeverity })
  severity: TicketSeverity;

  @Column({ type: 'simple-enum', enum: TicketStatus })
  status: TicketStatus;

  @Column({ nullable: true })
  externalRef?: string;

  @ManyToOne(() => Anomaly, { onDelete: 'CASCADE' })
  anomaly: Anomaly;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
