# nest-app — Server Monitor API

The backend API for **Server Monitor**. It manages monitored servers and log sources, runs log-analysis jobs, records anomalies from ingested logs, and raises tickets through an event-driven ticketing pipeline.

Part of the [server-monitor](../../README.md) monorepo. For the full architecture and data flow, see:
- [What is implemented](../../docs/IMPLEMENTATION.md)
- [Application flow](../../docs/APP_FLOW.md)

## Stack

- **NestJS 11** (modular architecture, global `ValidationPipe({ transform: true })`)
- **TypeORM 0.3** with **better-sqlite3** (`db.sqlite`, `synchronize: true` for dev)
- **`@nestjs/event-emitter`** — in-process event bus (anomaly → ticketing)
- **`@nestjs/swagger`** — OpenAPI docs at `/api`
- **class-validator / class-transformer** — DTO validation
- **Vitest** — unit/e2e tests

## Modules

| Module | Responsibility |
|--------|----------------|
| `AppModule` | Root wiring: TypeORM, event emitter, feature modules; `GET /` health check |
| `AuthModule` | Global `AuthGuard` — API-key auth (operator `API_KEY` / ingest `INGEST_KEY`), single fixed operator user + `@CurrentUser()` decorator |
| `UsersModule` | CRUD for users |
| `RemoteServersModule` | CRUD for monitored servers (owner-scoped) |
| `LogSourcesModule` | CRUD for log sources (`zabbix` / `prometheus`), owner-scoped |
| `LogAnalysisModule` | Log ingestion endpoint + `LogAnalysisJobsModule` (jobs, anomalies, dedup, event emission) |
| `TicketingModule` | Listens for `AnomalyCreatedEvent`, creates tickets via a provider factory (`InternalTicketingProvider` live; ServiceNow **stub**) |

## API surface

| Area | Base path | Endpoints | Auth |
|------|-----------|-----------|------|
| Health | `/` | `GET` | public |
| Users | `/users` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Remote servers | `/remote-servers` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Log sources | `/log-sources` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Log analysis jobs | `/log-analysis-jobs` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` | operator |
| Anomalies | `/log-analysis-jobs/:jobId/anomalies` | `GET` (paginated), `GET /:id`, `PATCH /:id` | operator |
| Tickets | `/tickets` | `GET` (paginated), `GET /:id` | operator |
| Log ingestion | `/log-analysis` | `POST /ingest/:jobId` | ingest key |
| API docs | `/api` | Swagger UI | — |

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

```json
{ "data": [ ], "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
```

## Running

```bash
# from the repo root (installs the whole workspace)
pnpm install

# from this directory
pnpm start          # production-style start
pnpm start:dev      # watch mode
pnpm start:prod     # node dist/main (after pnpm build)
```

The server listens on `process.env.PORT ?? 3000`. Swagger UI: `http://localhost:3000/api`.

## Testing

```bash
pnpm test           # vitest
pnpm test:watch     # watch mode
pnpm test:cov       # coverage
```

## Notes / current limitations

- **Single-tenant auth** — real API-key auth, but all data is scoped to one fixed operator user; no multi-tenant user↔owner linkage yet.
- **Ticketing** — the `InternalTicketingProvider` persists tickets and links them to anomalies; real Jira/ServiceNow integration stays a deferred stub.
- **No live log-source polling** — logs only enter via `POST /log-analysis/ingest/:jobId`.
- `synchronize: true` is set for development convenience; use migrations before any production use.

See the [Stubs & gaps](../../docs/IMPLEMENTATION.md#4-stubs--gaps-implemented-vs-not-yet-wired) section for the full list.
