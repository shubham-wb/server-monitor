import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import type { ICurrentUser } from './current-user.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  @Get('me')
  me(@CurrentUser() currentUser: ICurrentUser) {
    return currentUser;
  }
}
