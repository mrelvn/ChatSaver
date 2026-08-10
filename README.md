# ChatSaver

ChatSaver is an offline-first application that imports ChatGPT exports and turns user/assistant
message pairs into editable Q&A notes.

The browser database is the working source of truth. The Spring Boot API and PostgreSQL provide
authenticated cross-device backup and recovery when a connection is available.

## Current vertical slice

- Import a ChatGPT `.zip` export or `conversations.json` and select specific chats.
- Follow the active ChatGPT message branch and preserve the source conversation.
- Generate editable question-and-answer blocks.
- Store conversations, messages, notes, blocks, import history, and an outbox in IndexedDB.
- Create blank notes and add, edit, reorder-ready, or remove Q&A blocks.
- Search, favorite, edit, and delete local notes with debounced autosave.
- Paginate, sort, filter, archive, and search note titles plus Q&A content.
- Open notes and focused actions from the `Ctrl/Cmd + K` command palette.
- Share through the device share sheet, copy, or download Markdown while offline.
- Download and restore a complete portable vault backup.
- Use a source-owned shadcn/Radix component system with Tailwind CSS 4.
- Render a responsive royal-crimson, black, and ivory workspace across mobile and desktop.
- Install the responsive interface as a PWA after a production build.
- Register and sign in through short-lived signed access tokens plus hashed, rotating refresh
  sessions bound to a device.
- Push the IndexedDB outbox to PostgreSQL in bounded, idempotent batches; pull cursor-based deltas;
  and restore a complete normalized vault after local browser data is cleared.
- Read tenant-scoped server note summaries through stable cursor pagination.
- Start a Spring Boot API with request tracing, standardized problem responses, and a
  Hibernate-managed PostgreSQL schema.

ChatGPT export files are parsed locally. Only the normalized conversations, messages, notes, and
Q&A blocks selected by the user are synchronized after sign-in.

## Requirements

- Node.js 20 LTS, 22 LTS, or 24+
- Java 21+
- Maven 3.9+
- PostgreSQL 17+

Node.js 23 may build the project but is not supported by every lint dependency. Prefer an even
numbered LTS release.

## Run the frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

For the actual offline service worker:

```powershell
npm.cmd run build
npm.cmd run start
```

Visit the application once while online. The app shell will then be available offline.

## Run the API with your PostgreSQL database

The development defaults target database `ChatSaver` on port `5432`, user `postgres`, with an
empty password. PostgreSQL must actually allow that authentication mode; otherwise set the real
`DATABASE_PASSWORD` in the process environment.

```powershell
cd backend
mvn.cmd spring-boot:run
```

The public status endpoint is `http://localhost:8080/api/v1/system/status`. Hibernate creates or
updates the schema when the API connects to PostgreSQL.

Backend deployment values are configured directly in
`backend/src/main/resources/application.yaml`. Refresh tokens are never returned in JSON: the API
stores their SHA-256 hashes and sends the raw value only in an `HttpOnly`, `SameSite=Strict` cookie.

Account routes:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Authenticated notes use `GET /api/v1/notes?view=ALL&limit=30`. Its opaque `nextCursor` provides
stable keyset pagination without leaking another user's records.

Synchronization routes:

- `POST /api/v1/sync/push` accepts at most 100 idempotent outbox mutations.
- `GET /api/v1/sync/snapshot?after=<cursor>` returns a full recovery at cursor `0` and compact
  entity/deletion deltas afterward.

## Deploy

Deploy `frontend/` as the Vercel project root. Set `API_ORIGIN` to the HTTPS origin of the deployed
Spring Boot API; Next.js proxies `/api/*` on the same site so secure, strict refresh cookies work
without exposing the backend URL to the browser.
Set `NEXT_PUBLIC_WEBSOCKET_URL` to that API origin so signed-in clients receive live sync notices.

Deploy `backend/` on the VPS using its included `Dockerfile`. Database credentials, the exact web
origin, JWT signing key, secure-cookie mode, connection pool, and server settings are consolidated
in `backend/src/main/resources/application.yaml`.

For Neon, copy the Java/JDBC connection details from Neon's Connect dialog into `DATABASE_URL`,
`DATABASE_USERNAME`, and `DATABASE_PASSWORD`; keep TLS enabled and set `SPRING_PROFILES_ACTIVE=prod`.

The Java API is deliberately kept outside Vercel's experimental multi-service runtime because
Java is not currently a validated Vercel Services runtime. The Vercel frontend remains the public
origin and proxies API traffic to the container.

## Verification

Run the complete project verification once:

```powershell
.\scripts\verify.ps1
```

It builds the frontend, packages the backend without tests, and runs exactly one fast backend smoke
test at the end.

## Architecture

- [System architecture](docs/architecture.md)
- [Database design](docs/database.md)
- [Synchronization protocol](docs/sync-protocol.md)
