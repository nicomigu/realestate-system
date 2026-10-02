'use client';

import type { AuthUser } from '@realestate-system/shared';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { apiFetch, clearToken, getToken } from '@/lib/api';
import { SessionContext } from './session';

// Every dashboard page renders inside this gate: no valid token, no dashboard.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    apiFetch('/auth/me')
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          // Expired, revoked or tampered with: start over at the login page.
          clearToken();
          router.replace('/login');
          return;
        }
        setUser((await res.json()) as AuthUser);
      })
      .catch(() => {
        if (!cancelled) router.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  function signOut() {
    clearToken();
    router.replace('/login');
  }

  return (
    <SessionContext value={user}>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-6">
          <span className="font-semibold">Riverside Realty</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              {user.name} · {user.role === 'ADMIN' ? 'Admin' : 'Agent'}
            </span>
            <button type="button" onClick={signOut} className="font-medium underline-offset-4 hover:underline">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </SessionContext>
  );
}
