import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    request['user'] = {
      id: 'default-user-1',
      name: 'Default User 1',
      email: 'default-user-1@example.com',
    };
    return true;
  }
}
