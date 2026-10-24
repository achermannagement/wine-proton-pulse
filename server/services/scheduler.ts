import type { AppConfig } from '../types';
import type { SyncManager } from './sync';

export interface Scheduler {
  start(): void;
  stop(): void;
  getNextRunAt(): number | null;
  isRunning(): boolean;
}

export function createScheduler(config: AppConfig, manager: SyncManager): Scheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let nextRunAt: number | null = null;
  let started = false;

  function schedule(delayMs: number): void {
    timer = setTimeout(tick, delayMs);
    timer.unref?.();
    nextRunAt = Date.now() + delayMs;
  }

  async function tick(): Promise<void> {
    timer = null;
    nextRunAt = null;
    try {
      await manager.run('scheduled');
    } catch (error) {
      console.error('[scheduler] sync failed:', error);
    } finally {
      if (started) {
        schedule(Math.max(1, config.newsRefreshMinutes) * 60_000);
      }
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      schedule(500);
    },
    stop() {
      started = false;
      if (timer) clearTimeout(timer);
      timer = null;
      nextRunAt = null;
    },
    getNextRunAt() {
      return nextRunAt;
    },
    isRunning() {
      return manager.isRunning();
    },
  };
}
