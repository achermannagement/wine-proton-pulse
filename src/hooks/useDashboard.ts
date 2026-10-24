import { createContext, useContext } from 'react';
import type { StatsDto } from '../lib/types';

export type ConnectionStatus = 'connecting' | 'live' | 'offline';
export type ToastTone = 'info' | 'success' | 'error';

export interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface DashboardContextValue {
  stats: StatsDto | null;
  statsLoading: boolean;
  statsError: string | null;
  status: ConnectionStatus;
  version: number;
  refreshing: boolean;
  refresh: () => Promise<void>;
  refreshStats: () => Promise<void>;
  toast: ToastState | null;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;
  watchlist: number[];
  isWatched: (appid: number) => boolean;
  toggleWatch: (appid: number) => void;
  lastVisit: number;
}

export const DashboardContext = createContext<DashboardContextValue | null>(null);

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
}
