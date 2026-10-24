import type { FastifyReply } from 'fastify';

interface SseClient {
  id: string;
  reply: FastifyReply;
}

interface SseEvent {
  id: number;
  type: string;
  data: string;
}

export interface EventHub {
  addClient(reply: FastifyReply): string;
  broadcast(type: string, data: unknown): void;
  startHeartbeat(): void;
  stopHeartbeat(): void;
  getClientCount(): number;
}

function formatEvent(event: SseEvent): string {
  return `id: ${event.id}\nevent: ${event.type}\ndata: ${event.data}\n\n`;
}

export function createEventHub(): EventHub {
  const clients = new Map<string, SseClient>();
  const history: SseEvent[] = [];
  let counter = 0;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  function addClient(reply: FastifyReply): string {
    const id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('retry: 5000\n\n');

    const lastId = Number.parseInt(
      String(reply.request.headers['last-event-id'] ?? '0'),
      10,
    );
    if (Number.isFinite(lastId) && lastId > 0) {
      for (const event of history.filter((candidate) => candidate.id > lastId)) {
        reply.raw.write(formatEvent(event));
      }
    }

    clients.set(id, { id, reply });
    reply.raw.on('close', () => clients.delete(id));
    return id;
  }

  function broadcast(type: string, data: unknown): void {
    const event: SseEvent = {
      id: ++counter,
      type,
      data: JSON.stringify(data),
    };
    history.push(event);
    if (history.length > 80) history.splice(0, history.length - 80);

    const payload = formatEvent(event);
    for (const [id, client] of clients) {
      try {
        client.reply.raw.write(payload);
      } catch {
        clients.delete(id);
      }
    }
  }

  return {
    addClient,
    broadcast,
    startHeartbeat() {
      if (heartbeat) return;
      heartbeat = setInterval(() => {
        broadcast('heartbeat', { timestamp: Date.now() });
      }, 25_000);
      heartbeat.unref?.();
    },
    stopHeartbeat() {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    },
    getClientCount() {
      return clients.size;
    },
  };
}
