import type { ChatMessage, ChatSessionResponse } from '@realestate-system/shared';
import { API_URL } from './api';

const CHAT_TOKEN_KEY = 'chatToken';

/** Fired on `window` to open the chat widget, e.g. after the lead form stored a token. */
export const OPEN_CHAT_EVENT = 'open-chat';

export function openChat(): void {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

// The chat token is the Visitor's only key to their conversation, so it
// survives reloads. Same storage caveats as the dashboard token in api.ts.
export function getChatToken(): string | null {
  try {
    return localStorage.getItem(CHAT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setChatToken(token: string): void {
  try {
    localStorage.setItem(CHAT_TOKEN_KEY, token);
  } catch {
    // Storage disabled: the chat still works until the page is closed.
  }
}

export function clearChatToken(): void {
  try {
    localStorage.removeItem(CHAT_TOKEN_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/**
 * The Lead a chat token belongs to, or undefined for a visitor token (no Lead
 * until the first message). Only reads the payload; the API still verifies it.
 */
export function tokenLeadId(token: string): string | undefined {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { leadId?: unknown };
    return typeof claims.leadId === 'string' ? claims.leadId : undefined;
  } catch {
    return undefined;
  }
}

/** fetch() against the public chat routes, authenticated with a chat token. */
export function chatFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

/** A fresh visitor token: no Lead is created until the first message. */
export async function startChatSession(): Promise<string> {
  const res = await fetch(`${API_URL}/public/chat/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error(`Could not start a chat session (${res.status})`);
  const { chatToken } = (await res.json()) as ChatSessionResponse;
  return chatToken;
}

/**
 * Adds messages to a conversation, oldest first. The same message can arrive
 * twice (the POST response and the socket broadcast), so it's keyed by id.
 */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
