import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';

const TONE = {
  info: { icon: Info, className: 'border-proton-500/30 bg-ink-800 text-mist-200' },
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100',
  },
  error: { icon: AlertTriangle, className: 'border-red-500/30 bg-red-950/80 text-red-100' },
};

export function Toast() {
  const { toast, dismissToast } = useDashboard();
  if (!toast) return null;
  const meta = TONE[toast.tone];
  const Icon = meta.icon;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[60] flex justify-center sm:left-auto sm:right-5 sm:max-w-md"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
    >
      <div
        className={`flex w-full items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-2xl backdrop-blur-xl ${meta.className}`}
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 text-xs leading-relaxed">{toast.message}</p>
        <button
          type="button"
          onClick={dismissToast}
          className="rounded p-0.5 opacity-70 transition hover:opacity-100"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
