# Free hosting: in production the worker runs inside the API process

The live demo must cost nothing to host. Railway's free plan ($1/month, 3 services) can't run an API, a worker, Postgres and Redis, and free hosts don't offer background workers. So production runs on Render's free web service with Supabase Postgres, Render Key Value and Vercel. In that deployment the BullMQ worker starts inside the API process, switched on by config. This bends ADR 0003 without abandoning it: the worker stays a separate module with its own entrypoint, the API still never waits on the LLM, and local dev and the Playwright suite run the worker as its own process. Moving to separate services later is a configuration change, not a refactor.

## Consequences

- Render's free web service sleeps after 15 minutes without traffic, and delayed jobs (reminders, sequence steps) can't fire while it sleeps.

▎ An external scheduler (cron-job.org) pings /health every 10 minutes to keep it awake;One always-on service fits inside Render's 750 free hours a month.

- Render Key Value's free tier is in-memory only, so a restart loses queued jobs. That's acceptable for a demo that reseeds nightly, and it isn't acceptable for real customers.
- Postgres is on Supabase rather than Neon. The keep-awake ping hits the database every 10 minutes: on Neon that would burn most of the free 100 compute-hours a month, while Supabase's free compute isn't metered and the same pings stop its one-week inactivity pause. Render can't reach IPv6 addresses, so `DATABASE_URL` is Supabase's Session pooler string (IPv4), not the direct connection.
- Claude is the only paid part. Its spend is bounded by the daily cap on Claude calls.
