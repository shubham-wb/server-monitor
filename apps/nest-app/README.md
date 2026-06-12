# nest-app — Server Monitor API

The backend API for **Server Monitor**. It manages monitored servers and log sources, runs log-analysis jobs, records anomalies from ingested logs, and raises tickets through an event-driven ticketing pipeline.

Part of the [server-monitor](../../README.md) monorepo. For the full architecture and data flow, see:
- [What is implemented](../../docs/IMPLEMENTATION.md)
- [Application flow](../../docs/APP_FLOW.md)

## Stack

- **NestJS 11** (modular architecture, global `ValidationPipe`)
- **TypeORM 0.3** with **better-sqlite3** (`db.sqlite`, `synchronize: true` for dev)
- **`@nestjs/event-emitter`** — in-process event bus (anomaly → ticketing)
- **`@nestjs/swagger`** — OpenAPI docs at `/api`
- **class-validator / class-transformer** — DTO validation
- **Vitest** — unit/e2e tests

## Modules

| Module | Responsibility |
|--------|----------------|
| `AppModule` | Root wiring: TypeORM, event emitter, feature modules; `GET /` health check |
| `AuthModule` | Global `AuthGuard` (**stub** — injects a fixed `default-user-1`) + `@CurrentUser()` decorator |
| `UsersModule` | CRUD for users |
| `RemoteServersModule` | CRUD for monitored servers (owner-scoped) |
| `LogSourcesModule` | CRUD for log sources (`zabbix` / `prometheus`), owner-scoped |
| `LogAnalysisModule` | Log ingestion endpoint + `LogAnalysisJobsModule` (jobs, anomalies, dedup, event emission) |
| `TicketingModule` | Listens for `AnomalyCreatedEvent`, creates tickets via a provider factory (ServiceNow **stub**) |

## API surface

| Area | Base path | Endpoints |
|------|-----------|-----------|
| Health | `/` | `GET` |
| Users | `/users` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Remote servers | `/remote-servers` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log sources | `/log-sources` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log analysis jobs | `/log-analysis-jobs` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log ingestion | `/log-analysis` | `POST /ingest/:jobId` |
| API docs | `/api` | Swagger UI |

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

- **Auth is a stub** — every request runs as `default-user-1`; there is no token/API-key validation yet.
- **Ticketing is partially stubbed** — the ServiceNow provider's `createTicket` returns a fake ticket; `getTicket`/`updateTicket` are not implemented, and the result isn't persisted back to the anomaly.
- **No live log-source polling** — logs only enter via `POST /log-analysis/ingest/:jobId`.
- `synchronize: true` is set for development convenience; use migrations before any production use.

See the [Stubs & gaps](../../docs/IMPLEMENTATION.md#4-stubs--gaps-implemented-vs-not-yet-wired) section for the full list.
