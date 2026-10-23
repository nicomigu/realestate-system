'use client';

import { type ChatMessage, SendMessageSchema, type SendMessageResponse } from '@realestate-system/shared';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import {
  chatFetch,
  clearChatToken,
  getChatToken,
  mergeMessages,
  OPEN_CHAT_EVENT,
  setChatToken,
  startChatSession,
  tokenLeadId,
} from '@/lib/chat';

type Status = 'idle' | 'sending' | 'rate-limited' | 'failed';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const leadId = token ? tokenLeadId(token) : undefined;

  function openPanel() {
    // Re-read storage: the lead form may have just stored a token for its Lead.
    const stored = getChatToken();
    if (stored !== token) setMessages([]);
    setToken(stored);
    setOpen(true);
  }

  // The lead form opens the widget once it has a chat token for the new Lead.
  useEffect(() => {
    window.addEventListener(OPEN_CHAT_EVENT, openPanel);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, openPanel);
  });

  // No token yet: get a visitor token. No Lead exists until the first message.
  useEffect(() => {
    if (!open || token) return;
    let cancelled = false;
    startChatSession()
      .then((chatToken) => {
        if (cancelled) return;
        setChatToken(chatToken);
        setToken(chatToken);
      })
      .catch(() => {
        if (!cancelled) setError('Chat is unavailable right now. Please try again later.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  // A token with a Lead: load the history and listen for new messages.
  useEffect(() => {
    if (!open || !token || !leadId) return;
    let cancelled = false;

    async function loadHistory() {
      try {
        const res = await chatFetch('/public/chat/messages', token!);
        if (cancelled) return;
        if (res.status === 401) {
          // Expired or revoked: drop it, and the effect above starts a new session.
          clearChatToken();
          setToken(null);
          setMessages([]);
          return;
        }
        if (!res.ok) return;
        const history = (await res.json()) as ChatMessage[];
        if (!cancelled) setMessages((current) => mergeMessages(current, history));
      } catch {
        // Offline: the socket's reconnect will try again.
      }
    }

    void loadHistory();
    const socket = io(`${API_URL}/chat`, { auth: { token } });
    socket.on('message.created', (message: ChatMessage) => {
      setMessages((current) => mergeMessages(current, [message]));
    });
    // Anything sent while the connection was down only reaches us through the history.
    socket.io.on('reconnect', () => void loadHistory());

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [open, token, leadId]);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || status === 'sending') return;
    const form = event.currentTarget;
    const parsed = SendMessageSchema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please type a message.');
      return;
    }

    setError(null);
    setStatus('sending');
    try {
      const res = await chatFetch('/public/chat/messages', token, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 429) return setStatus('rate-limited');
      if (res.status === 401) {
        clearChatToken();
        setToken(null);
        setMessages([]);
        setError('Your chat session expired. Please send your message again.');
        return setStatus('idle');
      }
      if (!res.ok) return setStatus('failed');

      const sent = (await res.json()) as SendMessageResponse;
      setMessages((current) => mergeMessages(current, [sent.message]));
      if (sent.chatToken) {
        // This message created the Lead: switch to its token, which (re)connects the socket.
        setChatToken(sent.chatToken);
        setToken(sent.chatToken);
      }
      form.reset();
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="fixed right-4 bottom-4 z-50 h-14 rounded-full bg-zinc-900 px-6 font-medium text-white shadow-lg transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Chat with us
      </button>
    );
  }

  return (
    <section
      aria-label="Chat with Riverside Realty"
      className="fixed inset-x-0 bottom-0 z-50 flex h-[70vh] flex-col rounded-t-3xl bg-white shadow-2xl ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[32rem] sm:w-96 sm:rounded-3xl"
    >
      <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <h2 className="font-semibold">Riverside Realty</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">We usually reply within minutes</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close chat"
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          ×
        </button>
      </header>

      <ol ref={listRef} aria-live="polite" className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <li className="m-auto max-w-[16rem] text-center text-sm text-zinc-500 dark:text-zinc-400">
            Hi! Ask us anything about buying, selling or renting a home.
          </li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.author === 'LEAD'
                ? 'max-w-[80%] self-end rounded-2xl rounded-br-sm bg-zinc-900 px-4 py-2 text-sm whitespace-pre-wrap text-white dark:bg-white dark:text-zinc-900'
                : m.author === 'SYSTEM'
                  ? 'self-center px-4 py-1 text-center text-xs text-zinc-500 dark:text-zinc-400'
                  : 'max-w-[80%] self-start rounded-2xl rounded-bl-sm bg-zinc-100 px-4 py-2 text-sm whitespace-pre-wrap text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
            }
          >
            {m.body}
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {error && (
          <p role="alert" className="mb-2 px-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {status === 'rate-limited' && (
          <p role="alert" className="mb-2 px-1 text-sm text-red-600 dark:text-red-400">
            You&apos;re sending messages too fast. Please wait a moment.
          </p>
        )}
        {status === 'failed' && (
          <p role="alert" className="mb-2 px-1 text-sm text-red-600 dark:text-red-400">
            Your message wasn&apos;t sent. Please try again.
          </p>
        )}
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="chat-body">
            Message
          </label>
          <input
            id="chat-body"
            name="body"
            autoComplete="off"
            maxLength={2000}
            placeholder="Type a message…"
            disabled={!token}
            className="h-11 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-base outline-none focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300"
          />
          <button
            type="submit"
            disabled={!token || status === 'sending'}
            className="h-11 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
