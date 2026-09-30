import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.js';
import contractJson from './contract.json' with { type: 'json' };

// A factory rather than a module-level client, so the app can build it from
// validated config and tests can point it at their own database.
export function createDb(url: string) {
  return postgres<Contract>({ contractJson, url });
}

export type Db = ReturnType<typeof createDb>;
