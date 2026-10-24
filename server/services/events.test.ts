import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply } from 'fastify';
import { createEventHub } from './events';

function fakeReply(headers: Record<string, string> = {}) {
  const chunks: string[] = [];
  const closeHandlers: (() => void)[] = [];
  let status = 0;
  const raw = {
    writeHead(code: number) {
      status = code;
      return raw;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    on(event: string, handler: () => void) {
      if (event === 'close') closeHandlers.push(handler);
      return raw;
    },
  };
  const reply = {
    hijack: vi.fn(),
    raw,
    request: { headers },
  } as unknown as FastifyReply;
  return {
    reply,
    chunks,
    getStatus: () => status,
    close: () => closeHandlers.forEach((handler) => handler()),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SSE event hub', () => {
  it('writes headers, retry directive and broadcast events', () => {
    const hub = createEventHub();
    const client = fakeReply();
    hub.addClient(client.reply);

    expect(client.getStatus()).toBe(200);
    expect(client.chunks[0]).toContain('retry: 5000');
    expect(hub.getClientCount()).toBe(1);

    hub.broadcast('news_update', { count: 2 });
    expect(client.chunks.join('')).toContain('event: news_update');
    expect(client.chunks.join('')).toContain('"count":2');
  });

  it('replays missed events based on Last-Event-ID', () => {
    const hub = createEventHub();
    const first = fakeReply();
    hub.addClient(first.reply);
    hub.broadcast('first', { value: 1 });
    hub.broadcast('second', { value: 2 });

    const last = fakeReply({ 'last-event-id': '1' });
    hub.addClient(last.reply);
    const payload = last.chunks.join('');
    expect(payload).not.toContain('event: first');
    expect(payload).toContain('event: second');
  });

  it('removes clients when the connection closes', () => {
    const hub = createEventHub();
    const client = fakeReply();
    hub.addClient(client.reply);
    expect(hub.getClientCount()).toBe(1);
    client.close();
    expect(hub.getClientCount()).toBe(0);
  });

  it('broadcasts heartbeats on an interval', () => {
    vi.useFakeTimers();
    const hub = createEventHub();
    const client = fakeReply();
    hub.addClient(client.reply);
    hub.startHeartbeat();
    vi.advanceTimersByTime(25_000);
    expect(client.chunks.join('')).toContain('event: heartbeat');
    hub.stopHeartbeat();
  });
});
