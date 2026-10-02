'use client';

import { useSessionUser } from './session';

export default function DashboardPage() {
  const user = useSessionUser();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">Your pipeline will appear here.</p>
    </div>
  );
}
