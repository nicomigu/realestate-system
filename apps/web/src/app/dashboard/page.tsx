'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useSessionUser } from './session';

// The shape GET /leads returns. Only the fields this page shows.
interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  createdAt: string;
}

export default function DashboardPage() {
  const user = useSessionUser();
  const [leads, setLeads] = useState<LeadRow[] | null>(null);

  // A stand-in until the inbox (#21): the 20 newest Leads.
  useEffect(() => {
    let cancelled = false;
    apiFetch('/leads')
      .then(async (res) => {
        if (!cancelled && res.ok) setLeads((await res.json()) as LeadRow[]);
      })
      .catch(() => {
        // Offline: the list just stays empty.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user.name.split(' ')[0]}</h1>
      {leads === null || leads.length === 0 ? (
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Your pipeline will appear here.</p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-200 rounded-2xl ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/dashboard/leads/${lead.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span>
                  <span className="block font-medium">{lead.name ?? 'Unknown visitor'}</span>
                  <span className="block text-sm text-zinc-500">{lead.email ?? lead.phone ?? 'No contact yet'}</span>
                </span>
                <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium dark:bg-zinc-800">
                  {lead.stage.charAt(0) + lead.stage.slice(1).toLowerCase().replace(/_/g, ' ')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
