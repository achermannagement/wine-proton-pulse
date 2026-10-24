import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config';
import type { SyncManager, SyncResult } from './sync';
import { createScheduler } from './scheduler';

function fakeManager(): SyncManager & { run: ReturnType<typeof vi.fn> } {
  const result: SyncResult = {
    reason: 'scheduled',
    startedAt: 0,
    durationMs: 1,
    news: { found: 0, new: 0 },
    sources: [],
  };
  return {
    run: vi.fn().mockResolvedValue(result),
    requestManual: vi.fn(() => ({ started: true })),
    isRunning: vi.fn(() => false),
    getLastManualAt: vi.fn(() => null),
    getLastResult: vi.fn(() => null),
  } as unknown as SyncManager & { run: ReturnType<typeof vi.fn> };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduler', () => {
  it('runs immediately and then on the configured interval', async () => {
    vi.useFakeTimers();
    const manager = fakeManager();
    const config = loadConfig({
      newsRefreshMinutes: 30,
      disableScheduler: true,
      dataDir: '.tmp/scheduler-test',
    });
    const scheduler = createScheduler(config, manager);

    scheduler.start();
    expect(scheduler.getNextRunAt()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(manager.run).toHaveBeenCalledTimes(1);
    expect(manager.run).toHaveBeenCalledWith('scheduled');

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(manager.run).toHaveBeenCalledTimes(2);

    scheduler.stop();
    expect(scheduler.getNextRunAt()).toBeNull();
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(manager.run).toHaveBeenCalledTimes(2);
  });

  it('does not schedule twice when started repeatedly', async () => {
    vi.useFakeTimers();
    const manager = fakeManager();
    const config = loadConfig({
      newsRefreshMinutes: 30,
      disableScheduler: true,
      dataDir: '.tmp/scheduler-test',
    });
    const scheduler = createScheduler(config, manager);
    scheduler.start();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(manager.run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });
});
