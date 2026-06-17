/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AUTH_TYPE_KEY, AuthType, OPERATOR_USER } from './auth.constants';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const authType =
      this.reflector.getAllAndOverride<AuthType>(AUTH_TYPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? AuthType.OPERATOR;

    if (authType === AuthType.PUBLIC) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const presentedKey = this.extractKey(request);

    const expectedKey =
      authType === AuthType.INGEST
        ? process.env.INGEST_KEY
        : process.env.API_KEY;

    // Fail closed: a server started without a key configured rejects everything.
    if (!expectedKey) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    if (!presentedKey || !this.safeEqual(presentedKey, expectedKey)) {
      throw new UnauthorizedException('Invalid authentication key');
    }
    request['user'] = OPERATOR_USER;
    return true;
  }

  private extractKey(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer')) {
      return authHeader.slice('Bearer'.length).trim();
    }
    const apiKeyHeader = request.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
      return apiKeyHeader;
    }
    return undefined;
  }

  private safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  }
}
