# The API never calls the LLM: slow and timed work runs in a separate worker

The API process only validates input, writes to Postgres and emits a domain event. Every Claude call, sequence step, reminder and delayed email is a BullMQ job run by a separate `worker` entrypoint, which is the same image with a different start command. The worker pushes results to the dashboard through the Socket.IO Redis emitter. We chose this over calling Claude inline so that public routes answer fast, retries use exponential backoff, and deterministic job ids (such as `seq:<enrollmentId>:<step>`) make a retry never send twice. The cost is running a second deployed service plus Redis.

## Consequences

- If a job's retries run out or the daily Claude cap is hit, a Handoff is forced, so the Lead is never left in silence.
- Every delay is divided by `TIME_SCALE`, so demos can compress days into seconds.
