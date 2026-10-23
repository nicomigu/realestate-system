'use client';

import { type ChatMessage, SendMessageSchema } from '@realestate-system/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { apiFetch, clearToken } from '@/lib/api';

// The shape GET /leads/:id returns. Only the fields this page shows.
interface LeadProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  stage: string;
  firstResponseAt: string | null;
  createdAt: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  createdAt: string;
}

interface LeadDetail {
  lead: LeadProfile;
  messages: ChatMessage[];
  activity: ActivityEvent[];
}

const POLL_MS = 5000;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped after the Agent replies, to fetch again right away.
  const [refresh, setRefresh] = useState(0);

  // Live updates for the dashboard arrive with #7's socket; until then, poll.
  useEffect(() => {
    let cancelled = false;
    function fetchDetail() {
      apiFetch(`/leads/${id}`)
        .then(async (res) => {
          if (cancelled) return;
          if (res.status === 401) {
            clearToken();
            router.replace('/login');
            return;
          }
          if (res.status === 404) return setNotFound(true);
          if (!res.ok) return;
          const next = (await res.json()) as LeadDetail;
          if (!cancelled) setDetail(next);
        })
        .catch(() => {
          // Offline: the next poll tries again.
        });
    }
    fetchDetail();
    const timer = setInterval(fetchDetail, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, router, refresh]);

  async function onReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const form = event.currentTarget;
    const parsed = SendMessageSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please type a reply.');
      return;
    }

    setError(null);
    setSending(true);
    try {
      const res = await apiFetch(`/leads/${id}/messages`, { method: 'POST', body: JSON.stringify(parsed.data) });
      if (!res.ok) {
        setError('Your reply wasn’t sent. Please try again.');
        return;
      }
      form.reset();
      setRefresh((n) => n + 1);
    } catch {
      setError('Your reply wasn’t sent. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-zinc-600 dark:text-zinc-400">This Lead doesn&apos;t exist.</p>
        <BackLink />
      </div>
    );
  }

  if (!detail) {
    return <div className="text-sm text-zinc-500">Loading…</div>;
  }

  const { lead, messages, activity } = detail;

  return (
    <div className="mx-auto max-w-5xl">
      <BackLink />
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="flex min-h-[28rem] flex-col rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
          <h1 className="border-b border-zinc-200 px-5 py-4 text-xl font-semibold tracking-tight dark:border-zinc-800">
            {lead.name ?? 'Unknown visitor'}
          </h1>

          <ol className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
            {messages.length === 0 && (
              <li className="m-auto text-sm text-zinc-500 dark:text-zinc-400">No messages yet.</li>
            )}
            {messages.map((m) => (
              <li key={m.id} className={messageClass(m.author)}>
                {m.author !== 'SYSTEM' && (
                  <span className="mb-0.5 block text-xs opacity-70">
                    {authorLabel(m.author)} · {formatTime(m.createdAt)}
                  </span>
                )}
                {m.body}
              </li>
            ))}
          </ol>

          <form onSubmit={onReply} noValidate className="border-t border-zinc-200 p-3 dark:border-zinc-800">
            {error && (
              <p role="alert" className="mb-2 px-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="reply-body">
                Reply
              </label>
              <textarea
                id="reply-body"
                name="body"
                rows={2}
                maxLength={2000}
                placeholder="Write a reply…"
                className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-2 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300"
              />
              <button
                type="submit"
                disabled={sending}
                className="self-end rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl p-5 ring-1 ring-zinc-200 dark:ring-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Profile</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Source" value={humanize(lead.source)} />
              <Field label="Stage" value={humanize(lead.stage)} />
              <Field label="First response" value={lead.firstResponseAt && formatTime(lead.firstResponseAt)} />
              <Field label="Created" value={formatTime(lead.createdAt)} />
            </dl>
          </section>

          <section className="rounded-2xl p-5 ring-1 ring-zinc-200 dark:ring-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Timeline</h2>
            <ol className="mt-3 flex flex-col gap-2 text-sm">
              {activity.map((event) => (
                <li key={event.id} className="flex justify-between gap-4">
                  <span className="font-mono text-xs">{event.type}</span>
                  <time dateTime={event.createdAt} className="shrink-0 text-xs text-zinc-500">
                    {formatTime(event.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard" className="text-sm font-medium underline-offset-4 hover:underline">
      ← All Leads
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-zinc-500">{label}</dt>
      <dd>{value ?? '—'}</dd>
    </>
  );
}

// The Lead on the left, our side (Agent or Assistant) on the right, System centred.
function messageClass(author: ChatMessage['author']): string {
  const bubble = 'max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap';
  switch (author) {
    case 'LEAD':
      return `${bubble} self-start rounded-bl-sm bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50`;
    case 'SYSTEM':
      return 'self-center px-4 py-1 text-center text-xs text-zinc-500 dark:text-zinc-400';
    default:
      return `${bubble} self-end rounded-br-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`;
  }
}

function authorLabel(author: ChatMessage['author']): string {
  return { LEAD: 'Lead', AI: 'Assistant', AGENT: 'Agent', SYSTEM: 'System' }[author];
}

function humanize(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
