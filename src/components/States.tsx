import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-850/60 p-4">
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-4 w-16" />
        <SkeletonLine className="h-4 w-12" />
      </div>
      <SkeletonLine className="mt-3 h-5 w-4/5" />
      <SkeletonLine className="mt-2 h-4 w-full" />
      <SkeletonLine className="mt-1 h-4 w-2/3" />
      <div className="mt-4 flex gap-2">
        <SkeletonLine className="h-5 w-20" />
        <SkeletonLine className="h-5 w-24" />
      </div>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
      <AlertTriangle className="h-7 w-7 text-red-300" aria-hidden="true" />
      <p className="mt-3 max-w-md text-sm text-mist-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-mist-200 transition hover:border-proton-500/60 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-ink-700/70 bg-ink-850/40 px-6 py-12 text-center">
      <div className="rounded-xl bg-ink-800 p-3 text-mist-500">
        {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-mist-200">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-mist-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
