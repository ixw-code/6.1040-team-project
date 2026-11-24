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

The backend runs at <http://127.0.0.1:3000>. Its `/health` route returns HTTP 200
when MongoDB responds and 503 when it is unavailable. Vite forwards `/api` and
`/health` requests from the frontend to that backend, so browser requests can use
relative URLs. Set `BACKEND_ORIGIN` to override the Vite proxy target. Set `PUBLIC_ORIGIN` to the
exact browser origin when using a frontend URL other than `http://localhost:5173`.

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

## Alpha walkthrough

1. Register two accounts in separate browser profiles or a regular and a private window.
2. With the first account, create a household. From **Manage**, add the second account by username and add a work category.
3. With the second account, refresh households. In **Availability**, enter a block of time. In **Prefs**, choose a preference for the category.
4. In **Manage**, save a catalog chore with photo instructions, completion criteria, effort and a baseline image. Create an assignment whose start and deadline fit inside the resident's availability.
5. Select the week containing the assignment and click **Assign available residents**. An overseer can also choose an available assignee manually.
6. The resident opens the assignment in **My Tasks**, checks the baseline and submits a photo. The overseer opens **Review queue** to compare it against the saved baseline. Rejections require feedback. The resident can open the rejected attempt to read it and submit a new photo.
7. Approval records the resident's submission time as the completion time and credits the task once. **Reviewed** shows prior decisions, and **Manage** shows each member's points.

Work categories use Prefer, Neutral or Avoid. The scheduler combines preferences, workload and effort, and chooses randomly among equally suitable available residents. The overseer runs scheduling for the selected week. Alpha uses manual photo review and manual reassignment for trades.

## Verification

With MongoDB running, use `bun test` for the MongoDB-backed concept and HTTP suites,
`bun run check` for the assembly, generated contract and TypeScript checks, and
`bun run build` for the production frontend.
