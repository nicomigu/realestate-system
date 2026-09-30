#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c23cf60dc5b52006a3213af2afac97f5772c59a020d68efa505852b1f1c1bedb/contract';
import endContract from '../../snapshots/c23cf60dc5b52006a3213af2afac97f5772c59a020d68efa505852b1f1c1bedb/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'ActivityEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leadId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Appointment',
        columns: [
          col('agentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leadId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('BOOKED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Appointment_status_check_cd6f6c1c',
            "\"status\" IN ('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Lead',
        columns: [
          col('aiEnabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('area', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('assignedToId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('budgetMax', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firstResponseAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('intent', 'text', {
            notNull: true,
            default: lit('UNKNOWN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('preApproved', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('score', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('stage', 'text', {
            notNull: true,
            default: lit('NEW'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tags', 'text[]', {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: 'pg/text@1', many: true },
          }),
          col('temperature', 'text', {
            notNull: true,
            default: lit('COLD'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('timelineMonths', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Lead_intent_check_55273370',
            "\"intent\" IN ('BUYER', 'SELLER', 'INVESTOR', 'UNKNOWN')",
          ),
          checkExpression(
            'Lead_source_check_c0a17e31',
            "\"source\" IN ('WEBSITE', 'FACEBOOK', 'ZILLOW', 'GOOGLE_ADS', 'MANUAL')",
          ),
          checkExpression(
            'Lead_stage_check_e4cbd60e',
            "\"stage\" IN ('NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'CLOSED_WON', 'CLOSED_LOST')",
          ),
          checkExpression(
            'Lead_tags_elem_not_null_aecbe9e2',
            'array_position("tags", NULL) IS NULL',
          ),
          checkExpression(
            'Lead_temperature_check_f31e8577',
            "\"temperature\" IN ('HOT', 'WARM', 'COLD')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Message',
        columns: [
          col('author', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('body', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('channel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leadId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('meta', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Message_author_check_baa3fbc4',
            "\"author\" IN ('LEAD', 'AI', 'AGENT', 'SYSTEM')",
          ),
          checkExpression(
            'Message_channel_check_e9ea543c',
            "\"channel\" IN ('WEB', 'EMAIL', 'SMS')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Sequence',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('trigger', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'SequenceEnrollment',
        columns: [
          col('currentStep', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('leadId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sequenceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'SequenceEnrollment_status_check_666a942a',
            "\"status\" IN ('ACTIVE', 'STOPPED', 'DONE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'SequenceStep',
        columns: [
          col('channel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('delayMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sequenceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('template', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'SequenceStep_channel_check_e9ea543c',
            "\"channel\" IN ('WEB', 'EMAIL', 'SMS')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('AGENT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('User_role_check_8de2d3ca', "\"role\" IN ('ADMIN', 'AGENT')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebhookEvent',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('receivedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Sequence',
        constraint: 'Sequence_name_key',
        columns: ['name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'SequenceEnrollment',
        constraint: 'SequenceEnrollment_leadId_sequenceId_key',
        columns: ['leadId', 'sequenceId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'SequenceStep',
        constraint: 'SequenceStep_sequenceId_position_key',
        columns: ['sequenceId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WebhookEvent',
        constraint: 'WebhookEvent_idempotencyKey_key',
        columns: ['idempotencyKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityEvent',
        index: 'ActivityEvent_leadId_createdAt_idx_634711b6',
        columns: ['leadId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityEvent',
        index: 'ActivityEvent_leadId_idx_9113844c',
        columns: ['leadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ActivityEvent',
        index: 'ActivityEvent_type_createdAt_idx_00d94001',
        columns: ['type', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'Appointment_agentId_idx_8d0ba4f0',
        columns: ['agentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'Appointment_leadId_idx_9113844c',
        columns: ['leadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Appointment',
        index: 'appointment_agent_slot_booked_d474ab00',
        columns: ['agentId', 'startsAt'],
        extras: { where: "status = 'BOOKED'", unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lead',
        index: 'Lead_assignedToId_idx_45a131c2',
        columns: ['assignedToId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lead',
        index: 'Lead_source_createdAt_idx_ca471564',
        columns: ['source', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Lead',
        index: 'Lead_stage_idx_51755035',
        columns: ['stage'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Message',
        index: 'Message_leadId_createdAt_idx_634711b6',
        columns: ['leadId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Message',
        index: 'Message_leadId_idx_9113844c',
        columns: ['leadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SequenceEnrollment',
        index: 'SequenceEnrollment_leadId_idx_9113844c',
        columns: ['leadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SequenceEnrollment',
        index: 'SequenceEnrollment_sequenceId_idx_de377412',
        columns: ['sequenceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SequenceStep',
        index: 'SequenceStep_sequenceId_idx_de377412',
        columns: ['sequenceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ActivityEvent',
        foreignKey: {
          name: 'ActivityEvent_leadId_fkey',
          columns: ['leadId'],
          references: { schema: 'public', table: 'Lead', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Appointment',
        foreignKey: {
          name: 'Appointment_leadId_fkey',
          columns: ['leadId'],
          references: { schema: 'public', table: 'Lead', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Appointment',
        foreignKey: {
          name: 'Appointment_agentId_fkey',
          columns: ['agentId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Lead',
        foreignKey: {
          name: 'Lead_assignedToId_fkey',
          columns: ['assignedToId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Message',
        foreignKey: {
          name: 'Message_leadId_fkey',
          columns: ['leadId'],
          references: { schema: 'public', table: 'Lead', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SequenceEnrollment',
        foreignKey: {
          name: 'SequenceEnrollment_leadId_fkey',
          columns: ['leadId'],
          references: { schema: 'public', table: 'Lead', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SequenceEnrollment',
        foreignKey: {
          name: 'SequenceEnrollment_sequenceId_fkey',
          columns: ['sequenceId'],
          references: { schema: 'public', table: 'Sequence', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SequenceStep',
        foreignKey: {
          name: 'SequenceStep_sequenceId_fkey',
          columns: ['sequenceId'],
          references: { schema: 'public', table: 'Sequence', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
