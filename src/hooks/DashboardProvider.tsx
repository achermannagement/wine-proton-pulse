import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StatsDto } from '../lib/types';
import { ApiError, fetchStats, triggerRefresh } from '../lib/api';
import { useLocalStorage } from './useLocalStorage';
import { useSSE } from './useSSE';
import {
  DashboardContext,
  type ConnectionStatus,
  type ToastState,
  type ToastTone,
} from './useDashboard';

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<StatsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [watchlist, setWatchlist] = useLocalStorage<number[]>('pulse:watchlist', []);
  const [lastVisit] = useState(() => {
    try {
      return Number(window.localStorage.getItem('pulse:lastVisit') ?? 0) || 0;
    } catch {
      return 0;
    }
  });

  const lastUpdatedRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const refreshTimeoutRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      toast.tone === 'error' ? 6500 : 4500,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      window.localStorage.setItem('pulse:lastVisit', String(Math.floor(Date.now() / 1000)));
    } catch {
      void 0;
    }
  }, []);

  const applyStats = useCallback((next: StatsDto, bumpOnChange: boolean) => {
    setStats(next);
    setStatsError(null);
    setStatsLoading(false);
    const changed =
      lastUpdatedRef.current != null &&
      next.lastUpdated != null &&
      next.lastUpdated !== lastUpdatedRef.current;
    lastUpdatedRef.current = next.lastUpdated;
    if (bumpOnChange && changed) setVersion((value) => value + 1);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const next = await fetchStats();
      applyStats(next, false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatsError(error instanceof Error ? error.message : 'Unable to load stats');
      setStatsLoading(false);
    }
  }, [applyStats]);

  useEffect(() => {
    const controller = new AbortController();
    setStatsLoading(true);
    fetchStats(controller.signal)
      .then((next) => {
        applyStats(next, false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatsError(error instanceof Error ? error.message : 'Unable to load stats');
        setStatsLoading(false);
      });

    const timer = window.setInterval(() => {
      fetchStats()
        .then((next) => {
          const changed =
            lastUpdatedRef.current != null &&
            next.lastUpdated != null &&
            next.lastUpdated !== lastUpdatedRef.current;
          applyStats(next, false);
          if (changed) setVersion((value) => value + 1);
        })
        .catch(() => {
          setStatus('offline');
        });
    }, 60_000);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [applyStats]);

  const handleSseEvent = useCallback(
    (type: string, data: unknown) => {
      if (type === 'heartbeat') {
        setStatus('live');
        return;
      }

      if (type === 'fetch_complete') {
        if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
        refreshingRef.current = false;
        setRefreshing(false);
        setVersion((value) => value + 1);
        const payload = data as {
          news?: { new?: number };
          games?: { tierChanges?: number };
        } | null;
        const newItems = payload?.news?.new ?? 0;
        const changes = payload?.games?.tierChanges ?? 0;
        const bits = [
          newItems > 0 ? `${newItems} new ${newItems === 1 ? 'story' : 'stories'}` : null,
          changes > 0 ? `${changes} tier ${changes === 1 ? 'change' : 'changes'}` : null,
        ].filter(Boolean);
        showToast(bits.length > 0 ? `Sync complete — ${bits.join(', ')}.` : 'Sync complete.', 'success');
        void refreshStats();
        return;
      }

      if (type === 'fetch_error') {
        if (refreshTimeoutRef.current) window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
        refreshingRef.current = false;
        setRefreshing(false);
        const payload = data as { message?: string } | null;
        showToast(payload?.message ?? 'Sync failed. Check the source health panel.', 'error');
        void refreshStats();
        return;
      }

      if (type === 'news_update' || type === 'games_update' || type === 'awa_update') {
        setVersion((value) => value + 1);
        void refreshStats();
      }
    },
    [refreshStats, showToast],
  );

  useSSE({
    onEvent: handleSseEvent,
    onOpen: () => setStatus('live'),
    onError: () => setStatus('offline'),
  });

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const result = await triggerRefresh();
      if (result.started) {
        showToast('Refresh started — live updates will appear as sources respond.', 'info');
        refreshTimeoutRef.current = window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          refreshTimeoutRef.current = null;
        }, 150_000);
      } else if (result.reason === 'cooldown' && result.retryAfterMs != null) {
        refreshingRef.current = false;
        setRefreshing(false);
        showToast(`Refresh available in ${Math.ceil(result.retryAfterMs / 1000)}s.`, 'info');
      } else {
        showToast('A refresh is already running.', 'info');
      }
    } catch (error) {
      refreshingRef.current = false;
      setRefreshing(false);
      if (error instanceof ApiError && error.status === 429) {
        const payload = error.payload as { retryAfterMs?: number } | null;
        const seconds = payload?.retryAfterMs ? Math.ceil(payload.retryAfterMs / 1000) : 60;
        showToast(`Refresh available in ${seconds}s.`, 'info');
      } else {
        showToast(error instanceof Error ? error.message : 'Refresh failed.', 'error');
      }
    }
  }, [showToast]);

  const toggleWatch = useCallback(
    (appid: number) => {
      setWatchlist((previous) =>
        previous.includes(appid)
          ? previous.filter((value) => value !== appid)
          : [...previous, appid],
      );
    },
    [setWatchlist],
  );

  const isWatched = useCallback(
    (appid: number) => watchlist.includes(appid),
    [watchlist],
  );

  return (
    <DashboardContext.Provider
      value={{
        stats,
        statsLoading,
        statsError,
        status,
        version,
        refreshing,
        refresh,
        refreshStats,
        toast,
        showToast,
        dismissToast,
        watchlist,
        isWatched,
        toggleWatch,
        lastVisit,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
