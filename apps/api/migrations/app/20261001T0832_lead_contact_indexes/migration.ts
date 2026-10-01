#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7c1efddabdbfb3908796256374a3ab44079c24ca88a9bfbebcb93cb7de96b879/contract';
import endContract from '../../snapshots/7c1efddabdbfb3908796256374a3ab44079c24ca88a9bfbebcb93cb7de96b879/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c23cf60dc5b52006a3213af2afac97f5772c59a020d68efa505852b1f1c1bedb/contract';
import startContract from '../../snapshots/c23cf60dc5b52006a3213af2afac97f5772c59a020d68efa505852b1f1c1bedb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'Lead',
        index: 'Lead_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lead',
        index: 'Lead_phone_idx_8db23f45',
        columns: ['phone'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
