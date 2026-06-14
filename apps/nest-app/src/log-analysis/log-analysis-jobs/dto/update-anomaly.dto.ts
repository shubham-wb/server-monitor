import { IsEnum } from 'class-validator';
import { AnomalyStatus } from '../entities/anomaly.entity';

export class UpdateAnomalyDto {
  @IsEnum(AnomalyStatus)
  status: AnomalyStatus;
}
