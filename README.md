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

Run the backend tests with `bun test tests/` while MongoDB is running.
The CompletionChecking tests use real login cookies and stored photos with temporary
roles and tasks. The application needs the team's role and task hooks to serve live submissions.

## Photo uploads

Send a signed-in `POST /api/photos` request with the image file as the request body
and its `Content-Type` set to `image/jpeg`, `image/png`, or `image/webp`. Uploads can
be up to 1 MiB. The response contains a `photo` ID and the route for reading the image.
`GET /api/photos/:photo` returns the stored image to its uploader using the same session cookie.
After a photo is submitted for a chore, `GET /api/completion/submissions/:submission/photo`
lets the submitting resident and the household's Overseer view it through that submission.

For browser login and uploads in local development, set `PUBLIC_ORIGIN` to the URL
you open in the browser, such as `http://localhost:5173` for Vite.
