'use client';

import { LeadFormSchema } from '@realestate-system/shared';
import { type FormEvent, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type Field = 'name' | 'email' | 'phone';
type FieldErrors = Partial<Record<Field, string>>;
type Status = 'idle' | 'submitting' | 'done' | 'rate-limited' | 'failed';

export function LeadForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const utmSource = new URLSearchParams(window.location.search).get('utm_source') ?? undefined;

    // Same schema the API enforces, so most mistakes are caught before a round trip.
    const parsed = LeadFormSchema.safeParse({ ...fields, utmSource });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setStatus('submitting');
    try {
      const res = await fetch(`${API_URL}/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 429) return setStatus('rate-limited');
      if (!res.ok) return setStatus('failed');
      // The response's chat token is for the chat widget, which arrives with Web Chat (#8).
      setStatus('done');
    } catch {
      setStatus('failed');
    }
  }

  if (status === 'done') {
    return (
      <div role="status" className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
        <h2 className="text-lg font-semibold">Thanks! We&apos;ll be in touch shortly.</h2>
        <p className="mt-2 text-sm">Our assistant will reach out within seconds to learn what you&apos;re looking for.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField name="name" label="Full name" autoComplete="name" error={errors.name} />
      <TextField name="email" label="Email" type="email" autoComplete="email" error={errors.email} />
      <TextField name="phone" label="Phone" type="tel" autoComplete="tel" error={errors.phone} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Give us an email or a phone number, whichever you prefer.</p>

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="h-12 rounded-full bg-zinc-900 px-6 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {status === 'submitting' ? 'Sending…' : 'Find my dream home'}
      </button>

      {status === 'rate-limited' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Too many tries. Please wait a minute and try again.
        </p>
      )}
      {status === 'failed' && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}

function TextField(props: {
  name: Field;
  label: string;
  type?: string;
  autoComplete: string;
  error?: string;
}) {
  const errorId = `${props.name}-error`;
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {props.label}
      <input
        name={props.name}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        aria-invalid={props.error !== undefined}
        aria-describedby={props.error ? errorId : undefined}
        className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base font-normal outline-none focus:border-zinc-900 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300"
      />
      {props.error && (
        <span id={errorId} className="text-sm font-normal text-red-600 dark:text-red-400">
          {props.error}
        </span>
      )}
    </label>
  );
}
