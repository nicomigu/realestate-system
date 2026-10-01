import type { Models } from '../../prisma/contract.js';

export type LeadSource = Models.public_Lead['source'];

// Stored normalized, so duplicate matching is a plain equality check.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Keeps a leading "+" and the digits: "+63 917-123-4567" → "+639171234567".
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

const SOURCES_BY_UTM: Record<string, LeadSource> = {
  facebook: 'FACEBOOK',
  fb: 'FACEBOOK',
  zillow: 'ZILLOW',
  google: 'GOOGLE_ADS',
  'google-ads': 'GOOGLE_ADS',
  adwords: 'GOOGLE_ADS',
};

// Mapped on the server: the browser only sends the raw utm_source string.
export function leadSourceFromUtm(utmSource: string | undefined): LeadSource {
  if (!utmSource) return 'WEBSITE';
  return SOURCES_BY_UTM[utmSource.trim().toLowerCase()] ?? 'WEBSITE';
}
