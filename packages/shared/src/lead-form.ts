import { z } from 'zod';

// HTML forms send "" for a field left blank; treat that as "not given".
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

// The "Find your dream home" form. The web app validates with it before
// submitting, and the API validates every request with it again.
export const LeadFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Please tell us your name').max(120),
    email: optional(z.string().trim().max(254).pipe(z.email('Enter a valid email address'))),
    phone: optional(
      z.string().trim().regex(/^\+?[\d\s().-]{7,20}$/, 'Enter a valid phone number'),
    ),
    utmSource: optional(z.string().trim().max(100)),
  })
  .refine((form) => form.email !== undefined || form.phone !== undefined, {
    message: 'Give us an email address or a phone number',
    path: ['email'],
  });

export type LeadForm = z.infer<typeof LeadFormSchema>;

export interface LeadFormResponse {
  leadId: string;
  chatToken: string;
}
