import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { ICurrentUser } from './current-user.interface';

export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const currentUser: ICurrentUser = {
      id: 'default-user-1',
      name: 'Default User 1',
      email: 'default-user-1@example.com',
    };

    request['user'] = currentUser;
    return true;
  }
}
