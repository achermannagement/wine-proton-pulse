import { useEffect, useRef } from 'react';

export interface SseOptions {
  onEvent?: (type: string, data: unknown) => void;
  onOpen?: () => void;
  onError?: () => void;
}

const EVENT_TYPES = [
  'heartbeat',
  'news_update',
  'games_update',
  'awa_update',
  'fetch_complete',
  'fetch_error',
] as const;

export function useSSE({ onEvent, onOpen, onError }: SseOptions): void {
  const eventRef = useRef(onEvent);
  const openRef = useRef(onOpen);
  const errorRef = useRef(onError);
  eventRef.current = onEvent;
  openRef.current = onOpen;
  errorRef.current = onError;

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/events');

    source.onopen = () => openRef.current?.();
    source.onerror = () => errorRef.current?.();

    const listeners = EVENT_TYPES.map((type) => {
      const listener = (event: MessageEvent<string>) => {
        let data: unknown = null;
        try {
          data = JSON.parse(event.data);
        } catch {
          data = event.data;
        }
        eventRef.current?.(type, data);
      };
      source.addEventListener(type, listener as EventListener);
      return { type, listener };
    });

    return () => {
      for (const { type, listener } of listeners) {
        source.removeEventListener(type, listener as EventListener);
      }
      source.close();
    };
  }, []);
}
