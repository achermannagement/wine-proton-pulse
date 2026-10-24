import { useCallback, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initialValue : (JSON.parse(raw) as T);
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          void 0;
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, set];
}
