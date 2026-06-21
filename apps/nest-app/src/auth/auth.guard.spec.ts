import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { AuthGuard } from './auth.guard';
import { AuthType, OPERATOR_USER } from './auth.constants';

function contextWithHeaders(headers: Record<string, string>) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('AuthGuard', () => {
  let reflector: MockProxy<Reflector>;
  let guard: AuthGuard;

  beforeEach(() => {
    reflector = mock<Reflector>();
    guard = new AuthGuard(reflector);
    process.env.API_KEY = 'operator-key';
    process.env.INGEST_KEY = 'ingest-key';
  });

  it('allows public routes without a key', () => {
    reflector.getAllAndOverride.mockReturnValue(AuthType.PUBLIC);
    const { ctx } = contextWithHeaders({});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects operator routes with no credential', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined); // defaults to OPERATOR
    const { ctx } = contextWithHeaders({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects an incorrect operator key', () => {
    reflector.getAllAndOverride.mockReturnValue(AuthType.OPERATOR);
    const { ctx } = contextWithHeaders({ authorization: 'Bearer wrong' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('accepts the operator key and attaches the operator user', () => {
    reflector.getAllAndOverride.mockReturnValue(AuthType.OPERATOR);
    const { ctx, request } = contextWithHeaders({
      authorization: 'Bearer operator-key',
    });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toEqual(OPERATOR_USER);
  });

  it('accepts the operator key via the x-api-key header', () => {
    reflector.getAllAndOverride.mockReturnValue(AuthType.OPERATOR);
    const { ctx } = contextWithHeaders({ 'x-api-key': 'operator-key' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('ingest routes validate the ingest key, not the operator key', () => {
    reflector.getAllAndOverride.mockReturnValue(AuthType.INGEST);
    const ok = contextWithHeaders({ authorization: 'Bearer ingest-key' });
    expect(guard.canActivate(ok.ctx)).toBe(true);

    reflector.getAllAndOverride.mockReturnValue(AuthType.INGEST);
    const bad = contextWithHeaders({ authorization: 'Bearer operator-key' });
    expect(() => guard.canActivate(bad.ctx)).toThrow(UnauthorizedException);
  });

  it('fails closed when no key is configured', () => {
    delete process.env.API_KEY;
    reflector.getAllAndOverride.mockReturnValue(AuthType.OPERATOR);
    const { ctx } = contextWithHeaders({ authorization: 'Bearer anything' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
