# realestate-system

A real-estate lead system that answers every new Lead within seconds with an AI Assistant, qualifies them, and books a consultation into the Agent's calendar.

## Live

| | URL |
|---|---|
| Web | https://realestate-system-ashen.vercel.app |
| API health | https://realestate-api-w9qu.onrender.com/health |
| API docs (Swagger) | https://realestate-api-w9qu.onrender.com/docs |

Hosting is free: Render (API and Key Value), Supabase (Postgres) and Vercel (web). See [ADR 0004](docs/adr/0004-free-hosting-worker-in-process.md). The free API sleeps when idle, so the first request after a pause can take about a minute.

## Local setup

Requires Node 24, pnpm and Docker.

```sh
docker compose up -d                      # Postgres, Redis, Mailpit
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm --filter api db:reset                # migrate + seed
pnpm --filter api start:dev               # API on http://localhost:3000
pnpm --filter web dev                     # web on http://localhost:3001 if 3000 is taken
```

Tests:

```sh
pnpm --filter api test        # unit
pnpm --filter api test:e2e    # integration, against a separate test database
```

## Docs

- [CONTEXT.md](CONTEXT.md): the domain vocabulary (Lead, Agent, Assistant, Stage, Handoff…)
- [docs/adr](docs/adr): architecture decisions
- [Spec (#1)](https://github.com/nicomigu/realestate-system/issues/1) and its tickets in GitHub Issues
