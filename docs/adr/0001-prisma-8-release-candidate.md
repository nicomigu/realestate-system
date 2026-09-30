# Use Prisma 8 (release candidate) as the data layer

We build on Prisma 8 while it is still a release candidate (`8.0.0-rc`), not the stable Prisma 6/7 line. The reasons are its contract-first schema, planned and content-hashed migrations, and typed `db.orm` / `db.sql` query lanes, plus the fact that the project is meant to showcase a current stack. We accept RC churn in exchange.

## Consequences

- Enums are stored as `text` with a generated `CHECK` constraint, not native Postgres enums, so adding a value never needs `ALTER TYPE`.
- Timestamps are `TimestamptzString` (ISO strings, always UTC), because Node 24 has no global `Temporal` and we chose not to add a polyfill.
- Prisma 8 doesn't apply migrations from app code and has no `db seed` command. Migrations run as a Railway pre-deploy step, and `pnpm db:seed` runs `prisma/seed.ts` directly.
- CI fails if the committed `contract.json` differs from what `prisma contract emit` produces.
