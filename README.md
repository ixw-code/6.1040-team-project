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
It stays untracked. The example connects to the local `shift_happens` database
using the development credentials from `compose.yaml`.

On macOS, start the Podman machine after restarting your computer:

```sh
podman machine start
```

If no machine exists, run `podman machine init` first. If it is already running,
continue with:

```sh
bun run dev
```

This starts MongoDB, waits for an authenticated read/write check, and starts the
backend skeleton in watch mode at <http://127.0.0.1:3000>. Its `/health` route
returns HTTP 200 when MongoDB responds and 503 when it is unavailable. There are
no application endpoints or frontend yet. `HOST` and `PORT` can override the
backend address.

Ctrl+C stops the backend. MongoDB remains running so local data stays available.

