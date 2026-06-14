# Server Monitor — MVP Plan

> Scope decisions for this MVP:
> - **Audience:** internal single-tenant tool (one team monitors its own servers; auth stays minimal).
> - **Ticketing target:** internal ticket store persisted in our own DB, exposed via our own API. Real providers (Jira/ServiceNow) deferred.
> - **Anomaly detection:** keep current behavior — every `error`/`critical` log opens one anomaly per job, deduped while open.

---

## The MVP thesis

The product's one promise is: **a log comes in → an anomaly is recorded → a ticket an operator can actually see and act on comes out.**

Today the pipeline is wired end-to-end but breaks on that promise in two places:

1. The ticket the provider "creates" is **thrown away** — [ticketing.service.ts:41](../apps/nest-app/src/ticketing/ticketing.service.ts#L41) returns it, but nothing persists it to the anomaly, and there's no endpoint to read it.
2. There's **no way to view or close an anomaly**, so after the very first error on a job the dedupe gate ([log-analysis-jobs.service.ts:118-124](../apps/nest-app/src/log-analysis/log-analysis-jobs/log-analysis-jobs.service.ts#L118-L124)) latches shut **forever** — that job never raises another anomaly again.

So the MVP is not "add features" — it's **close the loop and make its output visible and resettable.** Everything below serves that.

---

## What already exists (the foundation — don't rebuild)

- ✅ Owner-scoped CRUD for servers, log sources, jobs
- ✅ Ingest endpoint + Fluent Bit forwarding (the real log path works)
- ✅ Anomaly creation + dedupe gate + event bus → ticketing listener
- ✅ Provider factory pattern + an e2e harness already proving the flow ([ticket-creation.e2e-spec.ts](../apps/nest-app/test/ticket-creation.e2e-spec.ts))

---

## Milestone 0 — Close the loop (the actual MVP core)

Non-negotiable. Without it the product doesn't do what it says.

| #   | Task | Where | Why |
|-----|------|-------|-----|
| 0.1 | **Add a `Ticket` entity** (`id`, `anomalyId` FK, `title`, `description`, `severity`, `status`, `externalRef?`, timestamps) | new `ticketing/entities/ticket.entity.ts` | A place for tickets to live |
| 0.2 | **`InternalTicketingProvider`** — `createTicket` saves a row; `getTicket`/`updateTicket` read/update it | new provider, register in [ticketing-provider.factory.ts](../apps/nest-app/src/ticketing/ticketing-providers/ticketing-provider.factory.ts) | Replaces the fake `id: 'random-id'` stub in [service-now-ticketing-provider.ts:8-17](../apps/nest-app/src/ticketing/ticketing-providers/service-now-ticketing-provider.ts#L8-L17) |
| 0.3 | **Persist the ticket back onto the anomaly** (`ticketInfo` = `{ ticketId, status }`) after creation | [ticketing.service.ts:41-46](../apps/nest-app/src/ticketing/ticketing.service.ts#L41-L46) | This is the discarded-result bug; the link must be saved |
| 0.4 | **Wrap the event handler in try/catch + log** | [ticketing.service.ts:20](../apps/nest-app/src/ticketing/ticketing.service.ts#L20) | It's a fire-and-forget async listener — a thrown provider error today vanishes silently |
| 0.5 | **Anomaly read/manage endpoints**: `GET /log-analysis-jobs/:jobId/anomalies`, `GET .../anomalies/:id`, `PATCH .../anomalies/:id` (status open→in_progress→closed) | new controller methods + service | Operators must *see* anomalies and *close* them to reopen the dedupe gate |
| 0.6 | **Ticket read endpoints**: `GET /tickets`, `GET /tickets/:id` | new `tickets` controller | The "operator can see the ticket" half of the promise |

**M0 done when:** ingest an error → `GET /tickets` shows a real persisted ticket linked to the anomaly → `PATCH` the anomaly to `closed` → a *new* error raises a *fresh* anomaly + ticket. Extend [ticket-creation.e2e-spec.ts](../apps/nest-app/test/ticket-creation.e2e-spec.ts) to assert persistence and the close→reopen cycle (swap the mocked factory for the real internal provider).

---

## Milestone 1 — Minimal real auth (single-tenant)

Single-tenant, so this is small but real.

- **1.1** Replace the hardcoded user in [auth.guard.ts:15-22](../apps/nest-app/src/auth/auth.guard.ts#L15-L22) with a static **API key check** against an env var (`API_KEY`). Reject with 401 on missing/bad key. Keep injecting a single fixed owner id — correct for single-tenant.
- **1.2** Give the **ingest endpoint its own token** (or a `@Public()` decorator + separate ingest key), since Fluent Bit posts machine-to-machine and shouldn't carry the operator key. Wire it into [docker-compose.yml](../apps/dummy-log-generator/docker-compose.yml) headers.
- **1.3** Move config to env (`PORT`, `DB_PATH`, `API_KEY`, `INGEST_KEY`) via `@nestjs/config`.

**M1 done when:** every endpoint returns 401 without the key; ingest works with the ingest key; no secrets are hardcoded.

---

## Milestone 2 — Operability (ship-readiness polish)

- **2.1** Job lifecycle, minimal: flip job `status` to `running` on first ingest. Skip the scheduler entirely.
- **2.2** Pagination on the list endpoints (anomalies/tickets will grow).
- **2.3** Decide on `synchronize: true` → keep for MVP but document it ([app.module.ts](../apps/nest-app/src/app.module.ts)); migrations are a post-MVP concern.
- **2.4** README/Swagger: document the real auth + ticket endpoints so the surface table in [IMPLEMENTATION.md](IMPLEMENTATION.md) stays honest.

---

## Explicitly OUT of scope for this MVP (defer, don't build)

Real features, but not needed to fulfill the promise — building them now is the trap:

- ❌ Real Jira/ServiceNow integration — keep `ServiceNowTicketingProvider` as a stub class; the factory just won't route to it
- ❌ Zabbix/Prometheus log-source **polling** — logs only enter via `/ingest`, and that's fine
- ❌ Recurring-job **scheduler** (the `one_time | recurring` distinction stays cosmetic)
- ❌ Multi-tenant auth, user↔owner linkage, the `User` table tie-in
- ❌ Smarter anomaly detection (chose to keep current behavior)

---

## Suggested sequence & rough effort

```
M0 (loop)  ████████████  ~2–4 days   ← do this first; it IS the MVP
M1 (auth)  ████          ~1 day
M2 (ops)   ████          ~1 day
```

M0 alone gives a demoable, honest product. M1 makes it safe to expose. M2 makes it pleasant to run.

**Highest-leverage fix:** tasks **0.3 + 0.5** together (persist the ticket, and let anomalies be closed) turn the current "fires once then goes dead" pipeline into a real monitoring loop.
