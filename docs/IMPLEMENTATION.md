# Server Monitor — What Is Implemented

A reference of everything currently built in the repository, module by module, with an honest split between **working** features and **stubs / placeholders**.

> Scope: this describes the code as it exists today. Where something is scaffolded but not wired up (e.g. real authentication, real ticketing), it is called out explicitly under "Stubs & gaps".

---

## 1. Repository layout

A [pnpm](https://pnpm.io) monorepo (`pnpm-workspace.yaml` → `apps/*`).

```
server-monitor/
├── apps/
│   ├── nest-app/              # The backend API (NestJS) — the core of the system
│   └── dummy-log-generator/   # A log-producing test harness (Express + Winston + Fluent Bit)
├── pnpm-workspace.yaml
└── package.json               # Root workspace manifest
```

| App | Purpose | Stack |
|-----|---------|-------|
| `nest-app` | REST API that owns servers, log sources, analysis jobs, anomalies, and ticketing | NestJS 11, TypeORM 0.3 + better-sqlite3, `@nestjs/event-emitter`, `@nestjs/swagger`, class-validator |
| `dummy-log-generator` | Emits realistic app logs and forwards error logs into the API for testing | Node + Express 4 + Winston 3, Fluent Bit sidecar, Docker |

---

## 2. `nest-app` — the backend API

### 2.1 Bootstrap (`src/main.ts`)

- Creates the Nest app and listens on `process.env.PORT ?? 3000`.
- **Swagger** docs served at `GET /api` ("Server Monitor API").
- A **global `ValidationPipe`** is applied, so all `class-validator`-decorated DTOs are enforced on incoming requests.

### 2.2 Root module (`src/app.module.ts`)

- **TypeORM** configured with `better-sqlite3`, database file `db.sqlite`, `autoLoadEntities: true`, `synchronize: true` (schema auto-created from entities — convenient for dev, not safe for prod).
- **`EventEmitterModule.forRoot()`** enables the in-process event bus used by the anomaly → ticketing flow.
- Imports every feature module: Users, RemoteServers, Auth, LogSources, LogAnalysis, Ticketing.
- `AppController` exposes a single `GET /` → `"Hello World!"` health/sanity endpoint.

### 2.3 Auth (`src/auth/`) — **stub**

- **`AuthGuard`** is registered as a **global guard** (provider token `APP_GUARD`). It runs on every request, but currently does **not** validate anything — it injects a hardcoded user onto the request:
  ```ts
  { id: 'default-user-1', name: 'Default User 1', email: 'default-user-1@example.com' }
  ```
  The code carries `TODO`s to parse a bearer token and/or API key later.
- **`@CurrentUser()`** param decorator reads `request.user` (set by the guard) and hands it to controllers.
- `AuthService` and `AuthController` are **empty placeholders**.

**Net effect:** there is no real authentication. Every request is treated as the same fake user, so all "owner-scoped" data is effectively scoped to `default-user-1`.

### 2.4 Users (`src/users/`) — working CRUD

- Entity `User`: `id` (uuid), `name`, `email`.
- Full REST CRUD at `/users` (`POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id`).
- **Not** linked to the auth user — this table is independent of the `default-user-1` identity the guard injects.

### 2.5 Remote Servers (`src/remote-servers/`) — working CRUD

Represents a monitored server/host.

- Entity `RemoteServer`: `id` (uuid), `name`, `ownerId`, `description?`, `config` (JSON), `status`, `createdAt`, `updatedAt`.
- `status` enum: `online | offline | maintenance | unknown`. New records default to `unknown`.
- Endpoints at `/remote-servers`: create / list / get / update / delete.
  - `create` and `findAll` are **owner-scoped** (use `currentUser.id`).
  - `findOne`, `update`, `remove` currently operate by `id` only (not owner-scoped).

### 2.6 Log Sources (`src/log-sources/`) — working CRUD

Represents where logs come from (e.g. a monitoring backend).

- Entity `LogSource`: `id` (uuid), `ownerId`, `name`, `description?`, `status`, `type`, `config` (JSON), timestamps.
- `type` enum: `zabbix | prometheus`. `status` enum: `online | offline | unknown` (defaults to `unknown`).
- Endpoints at `/log-sources`: create / list / get / update / delete — **all owner-scoped**.

> Note: the `type` and `config` describe an intended integration, but there is no code that actually connects to Zabbix/Prometheus or polls them yet (see Stubs & gaps).

### 2.7 Log Analysis (`src/log-analysis/`) — core feature

This is the heart of the system. It has two parts: **jobs** (the configuration + storage) and **ingestion** (the entry point for logs).

#### Entities

**`LogAnalysisJob`** — a configured analysis run tied to a server:
- `id`, `ownerId`, `name`, `description?`
- `status`: `pending | running | completed | initialized | failed` (created as `initialized`)
- `type`: `one_time | recurring`
- `ticketingSystemConfig?` (JSON) — provider config used by the ticketing flow
- `remoteServer` (ManyToOne, **required**) and `logSource` (ManyToOne, optional)
- `anomalies` (OneToMany)
- timestamps

**`Anomaly`** — a detected problem within a job:
- `id`, `status` (`open | in_progress | closed`), `title`, `description?`
- `severity`: `low | medium | high`
- `ticketInfo?` (JSON) — slot for ticket metadata
- `logAnalysisJob` (ManyToOne, `onDelete: CASCADE` — deleting a job deletes its anomalies)

#### Jobs CRUD (`/log-analysis-jobs`)

- Create / list / get / update / delete, all owner-scoped.
- `create` validates that the referenced `remoteServerId` exists (and the optional `logSourceId`) before saving.

#### Service logic (`LogAnalysisJobsService`)

- `addAnomaly(job, {...})` — the **deduplication gate**: if the job already has an anomaly in `open` or `in_progress` status, the new one is **skipped**. Otherwise it creates an `open` anomaly and **emits an `AnomalyCreatedEvent`** (`{ ownerId, jobId, anomalyId }`).
- `getAnomaly`, `getTicketingSystemConfig` — helpers consumed by the ticketing service.

#### Ingestion endpoint (`LogAnalysisController`)

- **`POST /log-analysis/ingest/:jobId`** — accepts an array of arbitrary log records.
- For each log it derives `message` and `level`, then calls `addAnomaly`, mapping severity: `level === 'critical'` → **HIGH**, otherwise → **MEDIUM**.
- This is the endpoint the `dummy-log-generator` (via Fluent Bit) posts to.

### 2.8 Ticketing (`src/ticketing/`) — event-driven, provider stubbed

- **`TicketingService`** subscribes to `AnomalyCreatedEvent` (`@OnEvent`). On each event it:
  1. Loads the job's `ticketingSystemConfig`. If there's no `type`, it does nothing (ticketing is opt-in per job).
  2. Builds a provider via `TicketingProviderFactory`.
  3. Reloads the anomaly; if it's still `open`, it calls `provider.createTicket(...)`, mapping anomaly severity → ticket severity.
- **`TicketingProviderFactory`** switches on `config.type`; the only registered provider is `ServiceNowTicketingProvider` (matched by class name). Unknown types throw.
- **`ServiceNowTicketingProvider`**: `createTicket` returns a **hardcoded fake ticket** (`id: 'random-id'`, status `open`). `getTicket` and `updateTicket` **throw "not implemented"**.
- Domain types (`ticketing.types.ts`): `Ticket`, `TicketCreate`, `TicketStatus`, `TicketSeverity` (`low | medium | high | critical`).

### 2.9 Shared events (`src/shared/events/`)

- `AppEvent<T>` — abstract base holding a typed `payload`.
- `AnomalyCreatedEvent` — payload `{ ownerId, jobId, anomalyId }`. This is the single event that bridges log analysis → ticketing.

### 2.10 Tests

- `*.spec.ts` files exist for several services/controllers (auth, users, remote-servers, log-sources, log-analysis, ticketing) plus an e2e scaffold under `test/`.
- Test runner is **Vitest** (`vitest.config.ts`, `vitest.setup.ts`); `vitest-mock-extended` is available for mocking.

---

## 3. `dummy-log-generator` — test log producer

A standalone container that simulates a noisy application and pipes its error logs into the API.

### 3.1 Node/Express app (`index.js`)

- Express server on port **3100**, using a **Winston** logger that writes structured JSON to `logs/combined.log` and `logs/error.log` (with rotation) plus a colorized console stream.
- Generates randomized traffic:
  - **Normal logs** — weighted `info` (60%) / `debug` (30%) / `warn` (10%) on a 1–5s random timer.
  - **Error logs** — from a large pool, on a 2–8s random timer, including stack traces.
  - Both loops **auto-start on boot**.
- HTTP control endpoints:

  | Method & path | Action |
  |---|---|
  | `GET /status` | Uptime + which generators are running + endpoint list |
  | `POST /generate-error` | Emit one error (optional `{ message?, type? }`) |
  | `POST /generate-batch` | Emit N errors (`{ count? }`, capped at 50) |
  | `POST /start-generation` / `POST /stop-generation` | Toggle the normal-log loop |
  | `POST /start-error-generation` / `POST /stop-error-generation` | Toggle the error-log loop |

### 3.2 Fluent Bit sidecar (`fluent-bit.conf`, `Dockerfile`, `docker-entrypoint.sh`)

- The Docker image installs **Fluent Bit**; the entrypoint runs Fluent Bit **and** the Node app together.
- Fluent Bit pipeline:
  - **Input** — tails `/app/logs/*.log`, parses each line as JSON.
  - **Filter** — `grep` keeps only records where `level` is `error` or `critical`.
  - **Output** — HTTP-POSTs the filtered JSON to `${HTTP_OUTPUT_HOST}:${HTTP_OUTPUT_PORT}${HTTP_OUTPUT_URI}`.
- `docker-compose.yml` wires those env vars to `host.docker.internal:3000/log-analysis/ingest/${LOG_ANALYSIS_JOB_ID}` — i.e. **error logs flow straight into the API's ingest endpoint** for a chosen job.

---

## 4. Stubs & gaps (implemented vs. not-yet-wired)

These are intentional to call out so the docs don't overstate what works:

- **Authentication** — guard is a hardcoded stub; no token/API-key validation. Everything runs as `default-user-1`.
- **Ticketing providers** — only ServiceNow exists, and its `createTicket` returns a fake ticket; `getTicket`/`updateTicket` throw. The returned ticket is **not** persisted back onto the anomaly's `ticketInfo` field.
- **Log source integrations** — `zabbix`/`prometheus` types and `config` are stored, but nothing polls or pulls from them. Logs only enter the system through the `/log-analysis/ingest/:jobId` endpoint.
- **Job lifecycle** — jobs are created as `initialized` and never transitioned to `running`/`completed`/`failed`; nothing acts on `one_time` vs `recurring` (no scheduler).
- **Owner scoping** — log sources and jobs are consistently owner-scoped; some `remote-servers` read/write endpoints are by `id` only.
- **Users vs. auth identity** — the `User` table is not connected to the `ownerId` used everywhere else.

---

## 5. Quick API surface summary

| Area | Base path | Endpoints |
|---|---|---|
| Health | `/` | `GET` |
| Users | `/users` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Remote servers | `/remote-servers` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log sources | `/log-sources` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log analysis jobs | `/log-analysis-jobs` | `POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| Log ingestion | `/log-analysis` | `POST /ingest/:jobId` |
| API docs | `/api` | Swagger UI |
