# Shift Happens

A chore coordination app for shared households.

Demo video: [Watch the resident screens demo](https://drive.google.com/file/d/1RtfwRtwCutBlOyW3axaCPyapHUWt_1ZF/view?usp=sharing)

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

The backend runs at <http://127.0.0.1:3000>. Its `/health` route returns HTTP 200
when MongoDB responds and 503 when it is unavailable. Vite forwards `/api` and
`/health` requests from the frontend to that backend, so browser requests can use
relative URLs. If you override the backend's `HOST` or `PORT`, update the proxy
targets in `web/vite.config.ts` as well.

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

## Backend tests

Run the tests with `bun test` while MongoDB is running. The suite includes
MongoDB-backed account and Alpha household-to-scheduling HTTP tests.
The CompletionChecking tests supply temporary sessions, roles, and tasks. The application
requires the team's implementations of those operations to serve authenticated requests.
