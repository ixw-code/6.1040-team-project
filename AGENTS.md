# Development environment

- Use Bun 1.4.2 and the committed `bun.lock`; install with `bun install --frozen-lockfile`.
- The current application is an empty sync-engine skeleton. Implement features only when requested.
- `bun run dev` starts local MongoDB, checks authenticated read/write access, and starts the backend at http://127.0.0.1:3000 in watch mode. There is no frontend yet.
- On macOS, Podman needs a running machine (`podman machine start`).
- MongoDB is defined in `compose.yaml`; copy `.env.example` to `.env` on first setup. Never commit `.env` or credentials.
- `bun run db:up` starts/checks MongoDB. `bun run db:check` checks the configured connection. Use the local database for development verification.
- `bun run db:down` preserves data. `bun run db:reset` deletes this project's local volume; do not run it unless a reset is requested.
- `bun run check` validates the current assembly, generated artifacts, and TypeScript. `bun run check:types` checks TypeScript alone.
- Draft specifications are in `design/`; `bun run check:design` currently reports syntax issues. Do not treat a passing skeleton check as validation of those drafts.
- When implementing features, update their design first, register their application documents in `generated.config.ts`, and run `bun run generate` followed by `bun run check`.
- Generate files in `generated/` through `bun run generate` rather than editing them by hand.
