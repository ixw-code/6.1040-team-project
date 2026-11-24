# Shift Happens

A chore coordination app for shared households.

## Local setup

Requirements: Bun 1.4.2, Podman, and a Compose provider (`podman compose version`).
MongoDB 8.0 runs in a container; no separate MongoDB installation is needed.

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Copy the environment file only on first setup; preserve an existing `.env`.
It stays untracked. The example sets `MONGODB_URI` for the local `shift_happens` database
using the development credentials from `compose.yaml`. If you already have
a MongoDB connection setting, use the `MONGODB_URI` key and keep its value.

On macOS, start the Podman machine after restarting your computer:

```sh
podman machine start
```

If no machine exists, run `podman machine init` first. If it is already running,
continue with:

```sh
bun run dev
```

This starts MongoDB, waits for an authenticated read/write check, and starts both
the backend and Vue frontend in watch mode. Open <http://localhost:5173>.
The development backend accepts requests from that origin by default. If you open
the frontend at a different origin, set `PUBLIC_ORIGIN` to that origin before
starting the backend.

The backend runs at <http://127.0.0.1:3000>. Its `/health` route returns HTTP 200
when MongoDB responds and 503 when it is unavailable. Vite forwards `/api` and
`/health` requests from the frontend to that backend, so browser requests can use
relative URLs. Vite uses the same `PORT` setting as the backend and connects
over loopback.

Ctrl+C stops both development servers. MongoDB remains running so local data
stays available.

## Run services separately

Start MongoDB:

```sh
bun run db:up
```

Then run the backend and frontend in separate terminals from the repository root:

```sh
bun run dev:backend
```

```sh
bun run dev:frontend
```

## Deployment

Run these commands from the repository root:

```sh
bun install --frozen-lockfile
bun run build
bun run start
```

Set `MONGODB_URI` to the deployment database and `PUBLIC_ORIGIN` to the
public HTTPS origin before starting the server. The production server defaults
to listening on `0.0.0.0:3000` and accepts `HOST` and `PORT` overrides.
Configure HTTPS on the reverse proxy and forward the frontend, `/api`, and
`/health` to this one process. Browser sign-in uses a Secure session cookie.

Keep `web/dist` with the backend source and runtime dependencies in the deployed
artifact. Vite runs during the build. Bun serves the generated HTML and assets.

## Backend tests

Run the tests with `bun test` while MongoDB is running. The suite includes
MongoDB-backed account and Alpha household-to-scheduling HTTP tests.
The CompletionChecking tests supply temporary sessions, roles, and tasks. The application
requires the team's implementations of those operations to serve authenticated requests.
