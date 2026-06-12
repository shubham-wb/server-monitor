# dummy-log-generator

A test harness that simulates a noisy application: it continuously emits realistic logs with **Winston**, and a bundled **Fluent Bit** sidecar tails those logs, keeps only the errors, and forwards them to the [Server Monitor API](../nest-app)'s ingest endpoint.

Use it to exercise the full pipeline — log → filter → ingest → anomaly → ticket — without a real application. See the end-to-end walkthrough in [docs/APP_FLOW.md](../../docs/APP_FLOW.md).

## What it does

```
Winston ──writes JSON──► logs/*.log ──tail──► Fluent Bit ──grep(error|critical)──► HTTP POST ──► nest-app /log-analysis/ingest/:jobId
```

- **Express server** on port `3100` with control endpoints (below).
- **Winston logger** writes structured JSON to `logs/combined.log` and `logs/error.log` (rotated) and a colorized console stream.
- **Two generators auto-start on boot:**
  - *normal logs* — weighted `info` (60%) / `debug` (30%) / `warn` (10%), every 1–5s
  - *error logs* — random error messages with stack traces, every 2–8s
- **Fluent Bit** (in the Docker image) filters to `level == error | critical` and POSTs the survivors to the API.

## HTTP endpoints

| Method & path | Action |
|---------------|--------|
| `GET /status` | Uptime, which generators are running, endpoint list |
| `POST /generate-error` | Emit one error — optional body `{ message?, type? }` (`type`: `database`, `authentication`, `network`, `file`, `memory`, `payment`) |
| `POST /generate-batch` | Emit a batch of errors — body `{ count? }` (capped at 50) |
| `POST /start-generation` / `POST /stop-generation` | Toggle the normal-log loop |
| `POST /start-error-generation` / `POST /stop-error-generation` | Toggle the error-log loop |

## Running locally (Node only)

```bash
pnpm install        # from repo root
pnpm dev            # nodemon index.js   (from this directory)
# or
pnpm start          # node index.js
```

Logs are written under `./logs`. Without Fluent Bit, nothing is forwarded — this just produces log files and serves the control API on `:3100`.

## Running the full pipeline (Docker)

The Docker image runs **both** Fluent Bit and the Node app (`docker-entrypoint.sh`).

```bash
# build & run, pointing Fluent Bit at a real analysis job
LOG_ANALYSIS_JOB_ID=<your-job-id> docker compose up --build
```

`docker-compose.yml` wires the Fluent Bit HTTP output to the API:

| Env var | Default | Meaning |
|---------|---------|---------|
| `PORT` | `3100` | Express port |
| `HTTP_OUTPUT_HOST` | `host.docker.internal` | API host (the running `nest-app`) |
| `HTTP_OUTPUT_PORT` | `3000` | API port |
| `HTTP_OUTPUT_URI` | `/log-analysis/ingest/${LOG_ANALYSIS_JOB_ID}` | Ingest path for your job |
| `HTTP_OUTPUT_TLS` | `Off` | TLS on/off |

> Create the analysis job first via `POST /log-analysis-jobs` on the API, then start this container with its id as `LOG_ANALYSIS_JOB_ID` so forwarded errors land against that job.

## Files

| File | Purpose |
|------|---------|
| `index.js` | Express app + Winston logger + generators |
| `fluent-bit.conf` | Fluent Bit pipeline: tail → grep → HTTP output |
| `parsers.conf` | JSON parser for the log files |
| `Dockerfile` | Node + Fluent Bit image |
| `docker-entrypoint.sh` | Starts Fluent Bit and the Node app together |
| `docker-compose.yml` | Local run with API output wiring |
