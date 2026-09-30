// Everything time-based (delays, minimum notice, staleness, reminders) reads the
// Clock, so tests can move time forward instead of waiting on real timers.
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
