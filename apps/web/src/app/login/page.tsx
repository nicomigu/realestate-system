'use client';

import { type LoginResponse, LoginSchema } from '@realestate-system/shared';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { apiFetch, setToken } from '@/lib/api';

type Status = 'idle' | 'submitting' | 'wrong-credentials' | 'rate-limited' | 'failed';

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [invalid, setInvalid] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setInvalid(!parsed.success);
    if (!parsed.success) return;

    setStatus('submitting');
    try {
      const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(parsed.data) });
      if (res.status === 401) return setStatus('wrong-credentials');
      if (res.status === 429) return setStatus('rate-limited');
      if (!res.ok) return setStatus('failed');
      const { accessToken } = (await res.json()) as LoginResponse;
      setToken(accessToken);
      router.replace('/dashboard');
    } catch {
      setStatus('failed');
    }
  }

  const message = {
    idle: null,
    submitting: null,
    'wrong-credentials': 'Wrong email or password.',
    'rate-limited': 'Too many attempts. Please wait a minute and try again.',
    failed: 'Something went wrong. Please try again.',
  }[status];

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Agent sign in</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">For the Riverside Realty team.</p>

        <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input name="email" type="email" autoComplete="username" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Password
            <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
          </label>

          {invalid && <p role="alert" className="text-sm text-red-600 dark:text-red-400">Enter your email and password.</p>}
          {message && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{message}</p>}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="h-12 rounded-full bg-zinc-900 px-6 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {status === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputClass =
  'h-12 rounded-xl border border-zinc-300 bg-white px-4 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300';
