import { z } from 'zod';

export const LoginSchema = z.object({
  // Lowercased so login matches however the address was typed.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password').max(200),
});

export type Login = z.infer<typeof LoginSchema>;

export type Role = 'ADMIN' | 'AGENT';

/** The signed-in dashboard user, as returned by `GET /auth/me`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
