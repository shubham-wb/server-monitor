import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ICurrentUser } from './current-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: ICurrentUser }>();

    return request.user;
  },
);
