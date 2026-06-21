import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { LogAnalysisService } from './log-analysis.service';
import { ApiBody } from '@nestjs/swagger';
import { CurrentUser } from '@/auth/current-user.decorator';
import { ICurrentUser } from '@/auth/current-user.interface';
import { IngestAuth } from '@/auth/auth.decorator';

@Controller('log-analysis')
export class LogAnalysisController {
  constructor(private readonly logAnalysisService: LogAnalysisService) {}

  @IngestAuth()
  @ApiBody({ type: Array<Record<string, any>> })
  @HttpCode(200)
  @Post('ingest/:jobId')
  ingestLogs(
    @Param('jobId') jobId: string,
    @Body() body: Array<Record<string, any>>,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisService.ingestLogs(jobId, currentUser.id, body);
  }
}
