'use client';

import type { AuthUser } from '@realestate-system/shared';
import { createContext, use } from 'react';

export const SessionContext = createContext<AuthUser | null>(null);

/** The signed-in user. Only usable inside the dashboard, which guarantees one. */
export function useSessionUser(): AuthUser {
  const user = use(SessionContext);
  if (!user) throw new Error('useSessionUser must be used inside the dashboard layout');
  return user;
}
