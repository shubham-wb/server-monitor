# MVP Milestone 2 — Operability (ship-readiness polish)

Implementation guide. Apply each change below in order. Every file is shown with
its full new content (for new/small files) or a clearly marked before→after (for
edits). This mirrors the format of [MVP_M1_AUTH.md](MVP_M1_AUTH.md).

## Goal

M0 closed the loop and M1 made it safe to expose. M2 makes it **pleasant and
honest to run**, without adding product features:

- **2.1** A job flips `status` → `running` the first time it receives logs (no scheduler).
- **2.2** The growth endpoints (`GET /tickets`, `GET /log-analysis-jobs/:jobId/anomalies`)
  are **paginated** with a reusable query DTO + response envelope.
- **2.3** `synchronize: true` is a deliberate, **documented** MVP choice (migrations deferred).
- **2.4** Swagger advertises bearer auth, and the docs (`IMPLEMENTATION.md`, READMEs)
  describe the *real* auth + ticket/anomaly surface instead of the old stub.

## Design decisions

- **Status transition lives in ingest, not a scheduler.** The plan explicitly
  defers scheduling. "First ingest = running" is the one lifecycle signal we have
  for free, and it's idempotent (only writes when the status actually changes).
- **Pagination changes the list response shape** from a bare array to
  `{ data, total, page, limit, totalPages }`. This is a breaking contract change,
  so the e2e/unit tests that read those endpoints are updated in the same step.
- **Scope pagination to the endpoints that grow** (tickets, anomalies). The
  `PaginationQueryDto` + `paginate()` helper are reusable, so jobs/servers/sources
  can adopt the same pattern later without rework — left out of M2 to keep the
  blast radius (and test churn) small.
- **Enable `ValidationPipe({ transform: true })`** so query strings coerce to the
  typed DTO (`?page=2` → `2`). Explicit `@Type(() => Number)` keeps it predictable.

---

# 2.1 — Flip job status to `running` on first ingest

## 1. Edit — `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts`

Add an idempotent `markRunning` method. Place it next to `update` (it already
imports `LogAnalysisJobStatus` and `LogAnalysisJob`).

Add this method to the class:

```ts
  /**
   * Transition a job to RUNNING the first time it does real work (ingest).
   * Idempotent: a no-op once the job is already running, so repeated ingests
   * don't issue redundant writes. The only lifecycle signal we have without a
   * scheduler (see MVP_PLAN.md M2.1).
   */
  async markRunning(job: LogAnalysisJob) {
    if (job.status === LogAnalysisJobStatus.RUNNING) {
      return job;
    }
    job.status = LogAnalysisJobStatus.RUNNING;
    return this.repo.save(job);
  }
```

## 2. Edit — `apps/nest-app/src/log-analysis/log-analysis.service.ts`

Call `markRunning` once per ingest, after the job is resolved.

Before:

```ts
    const job = await this.logAnalysisJobService.findOne(jobId, ownerId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    for (const log of logs) {
```

After:

```ts
    const job = await this.logAnalysisJobService.findOne(jobId, ownerId);

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    // First ingest moves the job from `initialized` to `running` (M2.1).
    await this.logAnalysisJobService.markRunning(job);

    for (const log of logs) {
```

> `findOne` loads the full entity (status included) but no relations, and
> `repo.save(job)` only updates loaded columns — relations are left untouched,
> same as the existing `update()` method.

---

# 2.2 — Pagination on the growth endpoints

## 3. New file — `apps/nest-app/src/shared/dto/pagination-query.dto.ts`

```ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Shared `?page=&limit=` query params for list endpoints. Requires the global
 * ValidationPipe to run with `transform: true` so the raw query strings are
 * coerced to numbers (see main.ts).
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
```

## 4. New file — `apps/nest-app/src/shared/dto/paginated-result.ts`

```ts
/** Envelope returned by paginated list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Build the envelope from a TypeORM `findAndCount` result. */
export function paginate<T>(
  data: T[],
  total: number,
  { page, limit }: { page: number; limit: number },
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
```

## 5. Edit — `apps/nest-app/src/main.ts` (enable transform)

Before:

```ts
  app.useGlobalPipes(new ValidationPipe());
```

After:

```ts
  // `transform: true` lets typed query DTOs (PaginationQueryDto) coerce
  // `?page=&limit=` strings into numbers.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
```

## 6. Edit — `apps/nest-app/src/ticketing/tickets.service.ts`

Before:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  findAll(ownerId: string) {
    return this.ticketRepo.find({
      where: {
        anomaly: {
          logAnalysisJob: {
            ownerId,
          },
        },
      },
    });
  }
```

After:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { paginate, PaginatedResult } from '@/shared/dto/paginated-result';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async findAll(
    ownerId: string,
    { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResult<Ticket>> {
    const [data, total] = await this.ticketRepo.findAndCount({
      where: {
        anomaly: {
          logAnalysisJob: {
            ownerId,
          },
        },
      },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, { page, limit });
  }
```

> `findOne` is unchanged. `Ticket` has a `createdAt` column, so we order newest-first
> for stable pagination.

## 7. Edit — `apps/nest-app/src/ticketing/tickets.controller.ts`

Before:

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: ICurrentUser) {
    return this.ticketsService.findAll(currentUser.id);
  }
```

After:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { CurrentUser } from '@/auth/current-user.decorator';
import type { ICurrentUser } from '@/auth/current-user.interface';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(
    @CurrentUser() currentUser: ICurrentUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ticketsService.findAll(currentUser.id, pagination);
  }
```

## 8. Edit — `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts` (paginate anomalies)

Before:

```ts
  listAnomalies(jobId: string, ownerId: string) {
    return this.anomalyRepo.find({
      where: { logAnalysisJob: { id: jobId, ownerId } },
    });
  }
```

After:

```ts
  async listAnomalies(
    jobId: string,
    ownerId: string,
    { page, limit }: PaginationQueryDto,
  ): Promise<PaginatedResult<Anomaly>> {
    const [data, total] = await this.anomalyRepo.findAndCount({
      where: { logAnalysisJob: { id: jobId, ownerId } },
      // Anomaly has no timestamp column; order by id for deterministic paging.
      order: { id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(data, total, { page, limit });
  }
```

Add the imports at the top of the file:

```ts
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
import { paginate, PaginatedResult } from '@/shared/dto/paginated-result';
```

> Note: `Anomaly` (see `entities/anomaly.entity.ts`) has no `createdAt`. Ordering
> by `id` (uuid) is arbitrary but stable — enough for MVP paging. Adding a
> `@CreateDateColumn` to `Anomaly` is a reasonable post-MVP follow-up.

## 9. Edit — `apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.controller.ts`

Before:

```ts
  @Get(':jobId/anomalies')
  listAnomalies(
    @Param('jobId') jobId: string,
    @CurrentUser() currentUser: ICurrentUser,
  ) {
    return this.logAnalysisJobsService.listAnomalies(jobId, currentUser.id);
  }
```

After:

```ts
  @Get(':jobId/anomalies')
  listAnomalies(
    @Param('jobId') jobId: string,
    @CurrentUser() currentUser: ICurrentUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.logAnalysisJobsService.listAnomalies(
      jobId,
      currentUser.id,
      pagination,
    );
  }
```

Add `Query` to the `@nestjs/common` import and import the DTO:

```ts
import { /* …existing… */ Query } from '@nestjs/common';
import { PaginationQueryDto } from '@/shared/dto/pagination-query.dto';
```

---

# 2.3 — Document `synchronize: true`

## 10. Edit — `apps/nest-app/src/app.module.ts`

Annotate the TypeORM config (no behavior change).

Before:

```ts
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DB_PATH ?? 'db.sqlite',
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
      // MVP choice: auto-create the schema from entities on boot. Convenient for
      // a single-tenant SQLite dev/demo deploy, but it can drop/alter columns on
      // entity changes. Migrations are a post-MVP concern (see MVP_PLAN.md M2.3).
      // Before any multi-instance / data-bearing deploy, set this to false and
      // generate migrations.
      synchronize: true,
    }),
```

---

# 2.4 — Swagger + docs honesty

## 11. Edit — controllers: advertise bearer auth in Swagger

`main.ts` already calls `.addBearerAuth()`, which registers the scheme. Add
`@ApiBearerAuth()` (and an `@ApiTags(...)`) to each protected controller so the
Swagger "Authorize" lock shows on those operations. Apply to all controllers
**except** the public health check; the ingest route uses the ingest key, so tag
it accordingly.

Example — `apps/nest-app/src/ticketing/tickets.controller.ts`:

```ts
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
// …
@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
```

Apply the same two decorators to: `RemoteServersController`, `LogSourcesController`,
`LogAnalysisJobsController`, `UsersController`, and `AuthController`. For
`LogAnalysisController` (ingest), tag it and note the credential:

```ts
@ApiTags('log-analysis')
@ApiBearerAuth() // uses INGEST_KEY, not the operator API_KEY
@Controller('log-analysis')
export class LogAnalysisController {
```

Leave `AppController` (health, `@Public()`) undecorated.

## 12. Edit — `docs/IMPLEMENTATION.md` (make it honest after M0 + M1 + M2)

The file still describes pre-M0/M1 reality. Apply these replacements:

**§2.1 Bootstrap** — change the ValidationPipe bullet to note transform:

> - A **global `ValidationPipe({ transform: true })`** is applied, so DTOs are
>   enforced and query params (e.g. pagination) are coerced to their typed values.

**§2.3 Auth** — replace the whole "stub" section with:

> ### 2.3 Auth (`src/auth/`) — **real API-key auth (single-tenant)**
>
> - **`AuthGuard`** is the global guard (`APP_GUARD`). It reads route metadata to
>   pick a credential: operator key (`API_KEY`) by default, log-shipper key
>   (`INGEST_KEY`) for `@IngestAuth()` routes, or none for `@Public()` routes.
>   Keys are compared in constant time; the guard **fails closed** (401) if no key
>   is configured. On success it attaches a single fixed operator user, so all
>   owner-scoped data stays under one tenant.
> - **`@Public()`** marks health; **`@IngestAuth()`** marks the ingest endpoint.
> - Keys come from env / `.env` (see `.env.example`); nothing is hardcoded.

**§2.8 Ticketing** — update the provider bullets to reflect the internal provider:

> - **`InternalTicketingProvider`** persists tickets to our own DB (`Ticket`
>   entity) and the created ticket is saved back onto the anomaly (`ticketInfo`).
>   `ServiceNowTicketingProvider` remains a deferred stub.
> - Read endpoints: **`GET /tickets`**, **`GET /tickets/:id`** (owner-scoped;
>   list is paginated).

**§4 Stubs & gaps** — remove the now-resolved bullets ("Authentication — guard is
a hardcoded stub", "the returned ticket is not persisted") and soften the
job-lifecycle bullet to:

> - **Job lifecycle** — jobs start `initialized` and flip to `running` on first
>   ingest; `completed`/`failed` and the `one_time`/`recurring` distinction are
>   still inert (no scheduler).

**§5 Quick API surface summary** — replace the table with:

| Area | Base path | Endpoints | Auth |
|---|---|---|---|
| Health | `/` | `GET` | public |
| Users | `/users` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Remote servers | `/remote-servers` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Log sources | `/log-sources` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Log analysis jobs | `/log-analysis-jobs` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Anomalies | `/log-analysis-jobs/:jobId/anomalies` | `GET` (paginated), `GET /:id`, `PATCH /:id` | operator |
| Tickets | `/tickets` | `GET` (paginated), `GET /:id` | operator |
| Log ingestion | `/log-analysis` | `POST /ingest/:jobId` | ingest key |
| API docs | `/api` | Swagger UI | — |

## 13. Edit — `apps/nest-app/README.md` (add Configuration + Auth)

Add a section documenting env config and how to call the API:

```md
## Configuration

Copy `.env.example` to `.env` and set:

| Var | Purpose | Default |
|-----|---------|---------|
| `API_KEY` | Operator key for all management endpoints | — (required) |
| `INGEST_KEY` | Log-shipper key for `POST /log-analysis/ingest/:jobId` | — (required) |
| `PORT` | HTTP port | `3000` |
| `DB_PATH` | SQLite file path | `db.sqlite` |

## Auth

All endpoints except `GET /` require a bearer token:

- Management endpoints: `Authorization: Bearer $API_KEY`
- Ingest endpoint: `Authorization: Bearer $INGEST_KEY`

Missing/invalid keys return `401`. The schema auto-syncs on boot
(`synchronize: true`) — fine for the MVP, not for production (migrations TBD).

## Pagination

List endpoints that grow (`GET /tickets`, `GET /log-analysis-jobs/:jobId/anomalies`)
accept `?page=` (default 1) and `?limit=` (default 20, max 100) and return:

​```json
{ "data": [ ... ], "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
​```
```

---

# 14. Tests

### 14a. Edit — `apps/nest-app/src/log-analysis/log-analysis.service.spec.ts`

`ingestLogs` now calls `markRunning`, so the mocked service needs that method or
every existing test throws.

Before:

```ts
const mockLogAnalysisJobsService = {
  findOne: vi.fn(),
  addAnomaly: vi.fn(),
};
```

After:

```ts
const mockLogAnalysisJobsService = {
  findOne: vi.fn(),
  addAnomaly: vi.fn(),
  markRunning: vi.fn(),
};
```

Add a test inside `describe('ingestLogs')`:

```ts
    it('marks the job running on ingest', async () => {
      mockLogAnalysisJobsService.findOne.mockResolvedValue(mockJob);
      mockLogAnalysisJobsService.addAnomaly.mockResolvedValue(undefined);

      await service.ingestLogs('job-1', 'owner-1', [
        { message: 'test', level: 'error' },
      ]);

      expect(mockLogAnalysisJobsService.markRunning).toHaveBeenCalledWith(mockJob);
    });
```

### 14b. Add — `markRunning` unit coverage in `log-analysis-jobs.service.spec.ts`

Add tests asserting it writes once when transitioning and is a no-op when already
`RUNNING` (mock `repo.save`). Also update any existing `listAnomalies` test: it
now returns `{ data, total, page, limit, totalPages }` from `findAndCount`, not a
bare array — mock `anomalyRepo.findAndCount` (resolving `[rows, count]`) instead
of `find`, and assert on `.data` / `.total`.

### 14c. Edit — `apps/nest-app/test/ticket-creation.e2e-spec.ts` (new response shape)

`GET /tickets` and `GET .../anomalies` now return the envelope. Update the three
reads:

```ts
          tickets = res.body.data; // was: res.body
```

```ts
      const anomalies = (
        await request(app.getHttpServer())
          .get(`/log-analysis-jobs/${jobId}/anomalies`)
          .set('Authorization', `Bearer ${API_KEY}`)
          .expect(200)
      ).body.data as Array<{ id: string }>; // was: .body
```

```ts
          expect(res.body.data).toHaveLength(2); // was: res.body
```

> The `expect(...).toHaveLength(1)` / `toHaveLength(1)` assertions stay — they now
> assert on the `data` array. (Auth headers were already added in M1.)

### 14d. Optional — assert running status in e2e

After the first ingest, `GET /log-analysis-jobs/:id` (operator key) should show
`status: 'running'`. A small assertion here proves 2.1 end-to-end.

---

# 15. Verify

```bash
pnpm --filter nest-app test       # unit
pnpm --filter nest-app test:e2e   # e2e
pnpm --filter nest-app build      # type-check (tests run under SWC, so build separately!)
```

Manual (with `.env` present):

```bash
pnpm --filter nest-app start:dev

# pagination envelope
curl -s -H "Authorization: Bearer dev-operator-key" \
  "http://localhost:3000/tickets?page=1&limit=5"

# job goes running after first ingest
curl -s -X POST -H "Authorization: Bearer dev-ingest-key" \
  -H "Content-Type: application/json" -d '[{"message":"boom","level":"error"}]' \
  http://localhost:3000/log-analysis/ingest/<jobId>
curl -s -H "Authorization: Bearer dev-operator-key" \
  http://localhost:3000/log-analysis-jobs/<jobId>   # -> "status":"running"
```

---

# 16. Definition of done

- [ ] A job's `status` is `running` after its first ingest; repeated ingests don't re-write it.
- [ ] `GET /tickets` and `GET /log-analysis-jobs/:jobId/anomalies` accept `?page=&limit=` and return `{ data, total, page, limit, totalPages }`; `limit` is capped at 100.
- [ ] `synchronize: true` is documented in `app.module.ts` and the README.
- [ ] Swagger UI shows the "Authorize" (bearer) control and tags; `IMPLEMENTATION.md` no longer calls auth/ticketing a stub and the surface table lists `/tickets` + anomaly routes.
- [ ] `pnpm --filter nest-app test`, `test:e2e`, **and `build`** all pass.

---

## Notes / follow-ups (not in M2 scope)

- Apply `PaginationQueryDto` + `paginate()` to the remaining list endpoints
  (jobs, servers, sources, users) for consistency.
- Add `@CreateDateColumn` to `Anomaly` so anomalies paginate newest-first like tickets.
- Owner-scope the `remote-servers` `findOne`/`update`/`remove` paths (still id-only).
- Replace `synchronize: true` with real TypeORM migrations before any production deploy.
