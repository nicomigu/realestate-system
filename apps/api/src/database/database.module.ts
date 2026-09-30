import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb, type Db } from '../../prisma/db.js';
import { ENV, type Env } from '../config/env.js';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [{ provide: DB, inject: [ENV], useFactory: (env: Env) => createDb(env.DATABASE_URL) }],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: Db) {}

  async onApplicationShutdown() {
    await this.db.close();
  }
}
