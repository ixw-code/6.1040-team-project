# Shift Happens

A chore coordination app for shared households.

## Deliverables

Find the deliverables for the Project Alpha under [the docs](./design/docs). Our composition and concept design documentation also live under [compositions/](./design/compositions/) and [concepts/](./design/concepts/) respectively.

### Demo Video
[Watch the demo here!](https://drive.google.com/file/d/1RtfwRtwCutBlOyW3axaCPyapHUWt_1ZF/view?usp=sharing)

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
relative URLs. Vite uses the same `PORT` setting as the backend and connects over
loopback. Set `BACKEND_ORIGIN` to override that proxy target.

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

## Alpha walkthrough

1. Register two accounts in separate browser profiles or a regular and a private window.
2. With the first account, create a household. From **Manage**, add the second account by username. In the **Chore catalog** tab, save the household’s reusable chores with descriptions, effort, and completion criteria. Add a baseline photo if you want to show residents what their evidence should look like.
3. With the second account, refresh households. In **Availability**, mark each weekday Available, Somewhat available, or Not available. In **Prefs**, rank the catalog chores from most to least preferred.
4. In **Chore catalog → Create assignment**, select a chore, then choose **Specific day** or **Date range**. Set the start time and deadline. To repeat the same day or window every week, choose **Repeat weekly** and set **Repeat through**.
5. Open **Manage** and choose an assignee in the assignment list. A weekly repeat appears as one assignment, and the chosen resident receives every open date through the end of the series. **Assign available residents** starts with people marked Available. Somewhat available is the fallback, and Not available is excluded. For a completion window, a resident can qualify on any day in the window.
6. The resident opens a dated task in **My Tasks**, checks the instructions and any baseline, and submits a photo during that occurrence’s window. The overseer opens **Review queue** to review the evidence against the criteria and any saved baseline. Rejections require feedback. The resident can open the rejected attempt to read it and submit a new photo before the window closes.
7. Approval records the resident's submission time as the completion time and credits the task once. **Reviewed** shows prior decisions, and **Manage** shows each member's points.

Residents rank each catalog chore once, regardless of how many tasks use it. The scheduler weighs that order with workload and task effort, and chooses randomly among equally suitable available residents. The overseer runs scheduling for the selected week. Existing time blocks continue to apply until someone saves weekly availability. Alpha uses manual photo review and manual reassignment for trades.

Only the overseer can delete chores and assignments. Deleting a chore removes it from the catalog and preferences, and its saved details are available to existing tasks. Deleting a weekly assignment removes the whole series from the schedule. The review history retains decisions and credit already earned.

## Verification

With MongoDB running, use `bun test` for the concept, HTTP and shared date tests.
Run `bun run check` for the assembly, generated contract and TypeScript checks,
and `bun run build` for the production frontend.

Run the browser smoke test to exercise the Vue app and API with separate overseer
and resident sessions. It starts temporary servers and uses a disposable MongoDB database.

```sh
bunx playwright install chromium
bun run test:browser
```

If Chrome is already installed, run `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome bun run test:browser`.
