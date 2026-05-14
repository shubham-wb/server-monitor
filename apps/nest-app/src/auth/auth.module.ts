import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: 'APP_GUARD',
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
