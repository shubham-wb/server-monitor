# MVP Milestone 1 — Minimal Real Auth (single-tenant)

Implementation guide. Apply each change below in order. Every file is shown with
its full new content (for new/small files) or a clearly marked before→after (for
edits).

## Goal

Replace the hardcoded-user stub with **real credential checks** driven by env vars,
while staying single-tenant:

- All management endpoints require an **operator key** (`API_KEY`).
- The ingest endpoint requires a separate **log-shipper key** (`INGEST_KEY`), so
  Fluent Bit carries a distinct credential from a human operator.
- Health check (`GET /`) stays public.
- Every authenticated request still resolves to one fixed owner, so existing
  owner-scoped data keeps working.

## Design decisions

- **No `@nestjs/config` dependency.** It isn't installed; instead we load `.env`
  with Node's built-in `process.loadEnvFile()` via a side-effect import that runs
  *before* any module reads `process.env`. Zero new dependencies, `.env` support
  for dev.
- **Metadata-driven guard.** A single global `AuthGuard` reads route metadata
  (`@Public()` / `@IngestAuth()`) to decide which key to validate. Default =
  operator key.
- **Fail closed.** If the server starts with no key configured, protected routes
  return 401 rather than silently allowing access.
- **Constant-time key comparison** (`crypto.timingSafeEqual`) to avoid timing
  leaks.

---

## 1. New file — `apps/nest-app/src/auth/auth.constants.ts`

```ts
import { ICurrentUser } from './current-user.interface';

/**
 * How a route is authenticated. The global {@link AuthGuard} reads this off
 * route metadata and picks which credential to validate against.
 *
 * - `OPERATOR` (default): requires the operator API key (`API_KEY`).
 * - `INGEST`: requires the log-shipper key (`INGEST_KEY`) — used by the
 *   machine-to-machine ingest endpoint so Fluent Bit carries a distinct
 *   credential from a human operator.
 * - `PUBLIC`: no credential required (health checks).
 */
export enum AuthType {
  OPERATOR = 'operator',
  INGEST = 'ingest',
  PUBLIC = 'public',
}

/** Reflector metadata key used by {@link Public} / {@link IngestAuth}. */
export const AUTH_TYPE_KEY = 'auth:type';

/**
 * Single-tenant identity. Every authenticated request resolves to this fixed
 * operator, so all owner-scoped data belongs to one tenant. (Kept stable as
 * `default-user-1` so data created before real auth was wired stays owned.)
 */
export const OPERATOR_USER: ICurrentUser = {
  id: 'default-user-1',
  name: 'Default User 1',
  email: 'default-user-1@example.com',
};
```

---

## 2. New file — `apps/nest-app/src/auth/auth.decorators.ts`

```ts
import { SetMetadata } from '@nestjs/common';
import { AUTH_TYPE_KEY, AuthType } from './auth.constants';

/** Marks a route as requiring no authentication (e.g. health checks). */
export const Public = () => SetMetadata(AUTH_TYPE_KEY, AuthType.PUBLIC);

/**
 * Marks a route as authenticated by the log-shipper key (`INGEST_KEY`) instead
 * of the operator key. Used for machine-to-machine ingestion.
 */
export const IngestAuth = () => SetMetadata(AUTH_TYPE_KEY, AuthType.INGEST);
```

---

## 3. Replace — `apps/nest-app/src/auth/auth.guard.ts`

Replace the whole file:

```ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AUTH_TYPE_KEY, AuthType, OPERATOR_USER } from './auth.constants';

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
      throw new UnauthorizedException('Invalid or missing API key');
    }

    request['user'] = OPERATOR_USER;
    return true;
  }

  /** Reads the key from `Authorization: Bearer <key>` or `x-api-key`. */
  private extractKey(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }

    const apiKeyHeader = request.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
      return apiKeyHeader;
    }

    return undefined;
  }

  /** Constant-time comparison to avoid leaking key length/contents via timing. */
  private safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return timingSafeEqual(aBuf, bBuf);
  }
}
```

**Why `@Injectable()` + constructor:** the guard now depends on `Reflector`.
Nest resolves that automatically because the guard is registered via `useClass`
(see next step).

---

## 4. Edit — `apps/nest-app/src/auth/auth.module.ts`

Use the `APP_GUARD` constant from `@nestjs/core` instead of the magic string.

Before:

```ts
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
```

After:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
```

> `'APP_GUARD'` and the imported `APP_GUARD` are the same value, so this is a
> readability fix — but it also documents intent. Functionally optional.

---

## 5. Edit — `apps/nest-app/src/app.controller.ts` (make health public)

Before:

```ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

After:

```ts
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/auth.decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
```

---

## 6. Edit — `apps/nest-app/src/log-analysis/log-analysis.controller.ts` (ingest uses ingest key)

Add the import and the `@IngestAuth()` decorator on the ingest route.

Before:

```ts
import { Controller, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { LogAnalysisService } from './log-analysis.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';

@Controller('log-analysis')
export class LogAnalysisController {
  constructor(private readonly logAnalysisService: LogAnalysisService) {}

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
```

After:

```ts
import { Controller, Param, Post, Body, HttpCode } from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import { LogAnalysisService } from './log-analysis.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';
import { IngestAuth } from '@/auth/auth.decorators';

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
```

> The ingest route still receives `currentUser` = the single operator (the guard
> attaches `OPERATOR_USER` on success), so the owner-scoped job lookup in
> `ingestLogs` keeps matching. The ingest key is only a *separate credential*,
> not a separate tenant.

---

## 7. New file — `apps/nest-app/src/load-env.ts`

This **must be imported first** in `main.ts` so `.env` is loaded before
`app.module.ts` evaluates its TypeORM config (which reads `DB_PATH`).

```ts
// Side-effect import: load .env into process.env before any other module
// (notably app.module's TypeORM config) reads from it. Imported first in main.ts.
// In CommonJS output, imports execute top-to-bottom, so importing this module
// ahead of AppModule guarantees the env is populated in time.
try {
  process.loadEnvFile();
} catch {
  // No .env file present — rely on the ambient environment (Docker/CI).
}
```

> `process.loadEnvFile()` is built into Node (>= 20.12 / 24, which this repo
> targets via `@types/node ^24`). No dependency needed.

---

## 8. Edit — `apps/nest-app/src/main.ts`

Add the `./load-env` import as the **first line**, and add `.addBearerAuth()` so
the Swagger UI gets an "Authorize" button.

Before:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Server Monitor')
    .setDescription('The Server Monitor API description')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

After:

```ts
import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Server Monitor')
    .setDescription('The Server Monitor API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api', app, documentFactory);

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## 9. Edit — `apps/nest-app/src/app.module.ts` (DB path from env)

Change only the `database` line in the TypeORM config.

Before:

```ts
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'db.sqlite',
      autoLoadEntities: true,
      synchronize: true,
    }),
```

After:

```ts
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? 'db.sqlite',
      autoLoadEntities: true,
      synchronize: true,
    }),
```

> Works because `./load-env` (step 7) runs before this module is imported.

---

## 10. New file — `apps/nest-app/.env.example` (committed)

```dotenv
# Operator API key — required for all management endpoints.
# Generate a strong random value, e.g. `openssl rand -hex 32`.
API_KEY=change-me-operator-key

# Log-shipper key — required by the machine-to-machine ingest endpoint
# (POST /log-analysis/ingest/:jobId). Must match INGEST_KEY in the
# dummy-log-generator / Fluent Bit environment.
INGEST_KEY=change-me-ingest-key

# HTTP port (optional, defaults to 3000).
PORT=3000

# SQLite database file path (optional, defaults to db.sqlite).
DB_PATH=db.sqlite
```

## 11. New file — `apps/nest-app/.env` (local, gitignored)

`.env` is already in `apps/nest-app/.gitignore`, so this stays out of git. Dev
values that let `pnpm start:dev` work immediately:

```dotenv
API_KEY=dev-operator-key
INGEST_KEY=dev-ingest-key
PORT=3000
DB_PATH=db.sqlite
```

---

## 12. Wire the ingest key into the log generator

### 12a. Edit — `apps/dummy-log-generator/.env`

Before:

```dotenv
LOG_ANALYSIS_JOB_ID = "6e64b3a0-b6db-4ba1-b122-9019bfc62207"
```

After (must match the API's `INGEST_KEY`):

```dotenv
LOG_ANALYSIS_JOB_ID = "6e64b3a0-b6db-4ba1-b122-9019bfc62207"
INGEST_KEY = "dev-ingest-key"
```

### 12b. Edit — `apps/dummy-log-generator/docker-compose.yml`

Add `INGEST_KEY` to the `environment` block so it reaches the container (and thus
Fluent Bit):

Before:

```yaml
    environment:
      PORT: 3100
      HTTP_OUTPUT_HOST: host.docker.internal
      HTTP_OUTPUT_PORT: 3000
      HTTP_OUTPUT_URI: /log-analysis/ingest/${LOG_ANALYSIS_JOB_ID}
      HTTP_OUTPUT_TLS: "Off"
```

After:

```yaml
    environment:
      PORT: 3100
      HTTP_OUTPUT_HOST: host.docker.internal
      HTTP_OUTPUT_PORT: 3000
      HTTP_OUTPUT_URI: /log-analysis/ingest/${LOG_ANALYSIS_JOB_ID}
      HTTP_OUTPUT_TLS: "Off"
      INGEST_KEY: ${INGEST_KEY}
```

### 12c. Edit — `apps/dummy-log-generator/fluent-bit.conf`

Add a `Header` line to the `[OUTPUT]` block so forwarded logs carry the key
(Fluent Bit substitutes `${INGEST_KEY}` from the container env):

Before:

```ini
[OUTPUT]
    Name             http
    Match            *
    Host             ${HTTP_OUTPUT_HOST}
    Port             ${HTTP_OUTPUT_PORT}
    URI              ${HTTP_OUTPUT_URI}
    Format           json
    Json_date_key    @timestamp
    Json_date_format iso8601
    Retry_Limit      3
    tls              ${HTTP_OUTPUT_TLS}
```

After:

```ini
[OUTPUT]
    Name             http
    Match            *
    Host             ${HTTP_OUTPUT_HOST}
    Port             ${HTTP_OUTPUT_PORT}
    URI              ${HTTP_OUTPUT_URI}
    Format           json
    Header           Authorization Bearer ${INGEST_KEY}
    Json_date_key    @timestamp
    Json_date_format iso8601
    Retry_Limit      3
    tls              ${HTTP_OUTPUT_TLS}
```

---

## 13. Tests

### 13a. Edit — `apps/nest-app/vitest.setup.ts` (provide test keys to e2e)

This file is the e2e `setupFiles` entry, so it runs before e2e specs build the
app. Set keys if not already present.

Before:

```ts
import { mock } from 'vitest-mock-extended';

(global as typeof globalThis & { mock: typeof mock }).mock = mock;
```

After:

```ts
import { mock } from 'vitest-mock-extended';

(global as typeof globalThis & { mock: typeof mock }).mock = mock;

// e2e specs exercise the global AuthGuard, which validates these keys.
process.env.API_KEY ??= 'test-api-key';
process.env.INGEST_KEY ??= 'test-ingest-key';
```

### 13b. New file — `apps/nest-app/src/auth/auth.guard.spec.ts` (unit)

```ts
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
```

### 13c. Replace — `apps/nest-app/test/auth.e2e-spec.ts`

The old tests asserted the stub (user returned with no/any token). Replace the
`describe('GET /auth/me')` block to assert real auth. Full file:

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DatabaseModule } from '@/database/database.module';
import { DatabaseTestModule } from '@/database/database-test.module';
import { OPERATOR_USER } from '@/auth/auth.constants';
import { resetDatabase } from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let moduleFixture: TestingModule;

  const API_KEY = process.env.API_KEY as string;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(DatabaseTestModule)
      .compile();

    app = moduleFixture.createNestApplication();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    await app.init();
  });

  afterEach(async () => {
    await resetDatabase(dataSource);
    await app.close();
  });

  describe('GET /auth/me', () => {
    it('returns 401 without a key', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 401 with an invalid key', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer wrong-key')
        .expect(401);
    });

    it('returns the operator user with a valid key', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${API_KEY}`)
        .expect(200);

      expect(response.body).toEqual(OPERATOR_USER);
    });
  });
});
```

### 13d. Edit — `apps/nest-app/test/ticket-creation.e2e-spec.ts` (add auth headers)

Add key constants near the top of the `describe`, then set the header on each
request. Operator requests use `API_KEY`; the ingest request uses `INGEST_KEY`.

Add after the existing `let ...;` declarations (top of the `describe` block):

```ts
  const API_KEY = process.env.API_KEY as string;
  const INGEST_KEY = process.env.INGEST_KEY as string;
```

Then update the three requests inside the test:

```ts
      // create a remote server  (operator key)
      const remoteServerResponse = await request(app.getHttpServer())
        .post('/remote-servers')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send(createRemoteServerDto)
        .expect(201);
```

```ts
      // create the job  (operator key)
      const logAnalysisJobResponse = await request(app.getHttpServer())
        .post('/log-analysis-jobs')
        .set('Authorization', `Bearer ${API_KEY}`)
        .send(createLogAnalysisJobDto)
        .expect(201);
```

```ts
      // send error logs to the job  (ingest key)
      await request(app.getHttpServer())
        .post(`/log-analysis/ingest/${jobId}`)
        .set('Authorization', `Bearer ${INGEST_KEY}`)
        .send(errorLogs)
        .expect(200);
```

> `app.e2e-spec.ts` makes no HTTP requests (it only asserts the app boots), so it
> needs no changes.

---

## 14. Verify

From the repo root:

```bash
# unit tests (includes the new auth.guard.spec.ts)
pnpm --filter nest-app test

# e2e tests (auth + ticket-creation now exercise real keys)
pnpm --filter nest-app test:e2e
```

Manual smoke test (with `apps/nest-app/.env` present):

```bash
pnpm --filter nest-app start:dev

# health is public -> 200
curl -i http://localhost:3000/

# protected without key -> 401
curl -i http://localhost:3000/remote-servers

# protected with operator key -> 200
curl -i -H "Authorization: Bearer dev-operator-key" http://localhost:3000/remote-servers

# ingest with operator key -> 401 (wrong credential class)
curl -i -X POST -H "Authorization: Bearer dev-operator-key" \
  -H "Content-Type: application/json" -d '[]' \
  http://localhost:3000/log-analysis/ingest/some-job-id

# ingest with ingest key -> 200/404 (auth passes; 404 only if job id is unknown)
curl -i -X POST -H "Authorization: Bearer dev-ingest-key" \
  -H "Content-Type: application/json" -d '[]' \
  http://localhost:3000/log-analysis/ingest/some-job-id
```

---

## 15. Definition of done

- [ ] Every management endpoint returns **401** without a valid `API_KEY`.
- [ ] Ingest endpoint accepts only `INGEST_KEY`; operator key is rejected there.
- [ ] `GET /` (health) works with no credential.
- [ ] No secrets hardcoded in source; keys come from env / `.env`.
- [ ] Fluent Bit forwards logs with the `Authorization` header and ingestion
      still works end-to-end.
- [ ] `pnpm --filter nest-app test` and `test:e2e` pass.

---

## Notes / follow-ups (not in M1 scope)

- `.env` auto-load uses `process.loadEnvFile()`. If you later add `@nestjs/config`
  you can swap `load-env.ts` for `ConfigModule.forRoot({ isGlobal: true })` and
  inject `ConfigService` into the guard.
- Multi-tenant auth (per-user keys, user↔owner linkage) remains deferred — see
  [MVP_PLAN.md](MVP_PLAN.md). The metadata-driven guard is a clean seam to grow
  into token/JWT validation later: only `AuthGuard.canActivate` changes.
