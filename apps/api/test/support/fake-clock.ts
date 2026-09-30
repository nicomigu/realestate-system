import type { Clock } from '../../src/clock/clock.js';

// A weekday mid-morning in the Agent's working hours, so booking tests start somewhere sensible.
export const DEFAULT_TEST_NOW = new Date('2026-10-05T14:00:00.000Z');

export class FakeClock implements Clock {
  private current = new Date(DEFAULT_TEST_NOW);

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  reset(): void {
    this.set(DEFAULT_TEST_NOW);
  }
}
