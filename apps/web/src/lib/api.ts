export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const TOKEN_KEY = 'dashboardToken';

// The dashboard token lives in localStorage because the API is on another site
// (Render vs Vercel), where browsers increasingly block cookies. The cost is
// that any script injected into the page could read it.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private mode or storage disabled: the user simply stays signed out.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

/** fetch() against the API, sending the dashboard token when there is one. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_URL}${path}`, { ...init, headers });
}
