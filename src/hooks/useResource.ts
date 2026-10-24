import { useEffect, useRef, useState } from 'react';

export interface ResourceState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useResource<T>(
  key: string,
  loader: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean; resetOnKey?: boolean } = {},
): ResourceState<T> & { reload: () => void } {
  const enabled = options.enabled ?? true;
  const resetOnKey = options.resetOnKey ?? false;
  const [state, setState] = useState<ResourceState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({
      data: resetOnKey ? null : previous.data,
      loading: true,
      error: null,
    }));

    loaderRef.current(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState((previous) => ({
          data: previous.data,
          loading: false,
          error: error instanceof Error ? error.message : 'Request failed',
        }));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, nonce, enabled, resetOnKey]);

  return {
    ...state,
    reload: () => setNonce((value) => value + 1),
  };
}
