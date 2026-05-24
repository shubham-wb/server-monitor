import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LogAnalysisJobType } from '../entities/log-analysis-job.entity';

export class UpdateLogAnalysisJobDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
