# Live Session Setup Tasks: POC

A small internal tool that lets operators manage the setup checklist for a live commerce session: create tasks, rename them, mark them done, delete them, and see them all in one place.

- **Backend:** Node.js + TypeScript, Express 5, Zod validation, JSON-file persistence
- **Frontend:** React 19 + TypeScript (Vite), consuming the REST API
- **API contract:** [`docs/openapi.yaml`](docs/openapi.yaml) (also served at `GET /api/openapi.yaml`)

```
server/   REST API (src/), API tests (test/)
client/   React UI
docs/     OpenAPI 3 spec
data/     created at runtime: tasks.json (git-ignored)
```

---

## Setup

**Requirements:** Node.js 20 or newer (developed on Node 22; see `.nvmrc`). Nothing else: no database, no Docker, no env vars.

```bash
npm install
npm run dev
```

- UI: http://localhost:5173 (Vite dev server, proxies `/api` to the backend)
- API: http://localhost:3001/api/tasks

### Single-process mode (closest to a staging deploy)

```bash
npm run build
npm start
```

This serves the API **and** the built UI from one process at http://localhost:3001.

### Other scripts

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm test`          | API integration tests (Vitest + Supertest)       |
| `npm run typecheck` | Type-checks server and client                    |

### Configuration (optional)

| Env var                  | Default            | Purpose                                         |
| ------------------------ | ------------------ | ----------------------------------------------- |
| `PORT`                   | `3001`             | Port for `npm start`. `npm run dev` always uses 3001, the proxy target. |
| `DATA_FILE`              | `./data/tasks.json` | Where tasks are persisted                       |
| `API_URL` (client dev)   | `http://localhost:3001` | Backend target for the Vite proxy          |
| `VITE_API_URL` (client build) | empty (same origin) | Absolute API origin, if the UI is hosted separately |

---

## API

All operations the UI uses are available over HTTP. Successful responses are wrapped in `{ "data": ... }`. Errors always look like `{ "error": { "code", "message", "details?" } }`.

| Method   | Path                    | Body                                  | Success              |
| -------- | ----------------------- | ------------------------------------- | -------------------- |
| `GET`    | `/api/tasks`            | optional `?completed=true\|false`     | `200` list           |
| `GET`    | `/api/tasks/:id`        |                                       | `200` task           |
| `POST`   | `/api/tasks`            | `{ "title": string }`                 | `201` task + `Location` |
| `PATCH`  | `/api/tasks/:id`        | `{ "title"?: string, "completed"?: boolean }` (at least one) | `200` task |
| `DELETE` | `/api/tasks/:id`        |                                       | `204`                |
| `GET`    | `/api/health`           |                                       | `200 {status:"ok"}`  |

A task looks like this:

```json
{
  "id": "0f19fd85-6205-4f4d-a9cd-0a4120208166",
  "title": "Upload product catalog",
  "completed": false,
  "createdAt": "2026-10-01T20:39:26.604Z",
  "updatedAt": "2026-10-01T20:39:26.604Z"
}
```

Error codes: `VALIDATION_ERROR` (400), `INVALID_JSON` (400), `TASK_NOT_FOUND` (404), `NOT_FOUND` (404, unknown route), `INTERNAL_ERROR` (500).

### Try it with curl

```bash
curl -X POST localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"Configure stream key"}'
curl localhost:3001/api/tasks
curl -X PATCH localhost:3001/api/tasks/<id> -H "Content-Type: application/json" -d '{"completed":true}'
curl -X PATCH localhost:3001/api/tasks/<id> -H "Content-Type: application/json" -d '{"title":"Configure stream key (backup)"}'
curl -X DELETE localhost:3001/api/tasks/<id>
```

### Design notes

- **`PATCH` covers both "update title" and "mark completed".** It's one resource with partial updates, rather than action endpoints like `/complete`. It also supports un-completing a task, which operators need when they tick a box by mistake.
- **Validation is strict.** Titles are trimmed and must be 1 to 200 chars. Unknown fields are rejected, so typos like `{"complete": true}` fail loudly instead of being silently ignored.
- **The storage layer sits behind a `TaskRepository` interface** ([`task.repository.ts`](server/src/tasks/task.repository.ts)). Swapping the JSON file for a real database doesn't touch the routes. Tests use the in-memory implementation.
- **Response envelope (`{data}` / `{error}`).** It leaves room for pagination metadata later without breaking clients.

---

## Assumptions

- One shared checklist. The brief doesn't mention multiple live sessions, so tasks aren't scoped to a session or event.
- A handful of internal users and a few dozen to a few hundred tasks. Everything fits in memory, and listing returns all tasks without pagination.
- A single server instance. The brief says multi-user concurrency isn't expected.
- The tool runs on a trusted internal network or a staging environment. Because of that, there's no auth and CORS is open.
- Task order is creation order. The brief doesn't mention priority or manual reordering.
- "Update task details" means the title, the only editable field the functional requirements list. Completion is updated through the same endpoint.
- Deletion is permanent (a hard delete). The UI asks for confirmation first.
- Data should survive a restart, since losing a checklist mid-preparation would be bad. That's why I used a JSON file instead of pure in-memory storage.

## Deliberately not implemented

| Left out | Why |
| --- | --- |
| Authentication and authorization | Explicitly out of scope for this phase |
| A real database | A JSON file gives persistence with zero setup. The repository interface makes swapping it out a contained change. |
| Concurrency control (ETags/`If-Match`, optimistic locking) | Multi-user concurrency isn't expected. Last write wins. |
| Real-time sync between operators (WebSockets/polling) | Same reason. Reload the page to see others' changes. |
| Pagination, search, sorting options | Data volume is tiny. Only a simple `completed` filter is included. |
| Extra task fields (assignee, due date, description, priority, session ID) | Not in the functional requirements. Easy to add to the schema. |
| Soft delete, undo, audit log | Out of scope for a POC |
| Frontend tests, E2E tests | Test effort went into the API, which is the contract. I verified the UI by hand. |
| Docker, CI pipeline, deployment config | Setup is `npm install && npm run dev`. See productionization below. |
| i18n, design system, accessibility audit | The UI is intentionally minimal. It has basic labels and keyboard support. |

## What it would take to productionize

1. **Persistence.** Move to Postgres (or the company's standard store) with migrations. Implement `TaskRepository` against it, and add indexes, backups, and retention.
2. **Data model.** Scope tasks to a live session or event (and probably to a partner or tenant). Add assignee, due time, ordering, and templates for recurring setup checklists.
3. **Security.** Add SSO/OIDC auth with roles (operator vs. viewer), lock CORS to known origins, add rate limiting and security headers (e.g. `helmet`), and validate request size and IDs.
4. **Concurrency and collaboration.** Use optimistic locking with `version` plus `If-Match` (and return 409 on conflict). Add real-time updates over SSE or WebSockets so several operators see the same checklist live. Add idempotency keys on create.
5. **API maturity.** Version the API (`/api/v1`), add pagination, generate the client SDK and types from the OpenAPI spec (instead of the hand-written mirror in `client/src/api.ts`), and validate responses against the spec in CI.
6. **Observability.** Add structured logging (pino) with request IDs, metrics, tracing, error tracking (e.g. Sentry), and readiness and liveness probes (`/api/health` already covers liveness).
7. **Operations.** Add a Dockerfile, a CI pipeline (lint, typecheck, test, build), config through environment variables or a secrets manager, graceful shutdown, and horizontal scaling. That last one requires the database first.
8. **Quality.** Add frontend component tests, Playwright E2E tests on the main flows, linting and formatting (ESLint/Prettier), and an audit log of who changed what.
9. **UX.** Add optimistic updates, undo for deletes, bulk actions, and checklist templates.

## Technical risks and limitations

- **JSON file storage is single-process only.** Two server instances, or two processes pointing at the same file, will overwrite each other's data. Writes go through an in-process queue and are atomic (write to a temp file, then rename), so a crash won't corrupt the file. But every write rewrites the whole file, which is O(n). That's fine for hundreds of tasks, not for production volumes.
- **No auth.** Anyone who can reach the port can read or delete everything. Don't expose this outside a trusted network.
- **Last write wins.** If two operators edit the same task at the same time, one change is silently lost, and other operators' changes don't show up until they refresh.
- **No schema migrations for the data file.** Changing the `Task` shape later means migrating `tasks.json` by hand. Startup fails loudly if the file isn't a JSON array, but it doesn't validate individual records.
- **Ephemeral filesystems.** On platforms with ephemeral disks (many PaaS and container setups), `data/tasks.json` disappears on redeploy unless `DATA_FILE` points to a mounted volume.
- **Type drift.** The client's `Task` type is a hand-kept copy of the server's. The OpenAPI spec is the source of truth but isn't enforced automatically yet.
