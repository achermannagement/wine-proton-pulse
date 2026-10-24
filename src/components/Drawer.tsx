import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = 'hidden';
      const timer = window.setTimeout(() => closeRef.current?.focus(), 50);
      return () => {
        window.clearTimeout(timer);
        document.body.style.overflow = '';
      };
    }
    if (dialog.open) dialog.close();
    document.body.style.overflow = '';
    return undefined;
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="drawer-dialog"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex h-full w-full items-end justify-center md:items-stretch md:justify-end"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="drawer-panel flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl md:h-full md:rounded-none md:border-y-0 md:border-r-0">
          <header className="flex items-start justify-between gap-4 border-b border-ink-700/80 bg-ink-900/95 px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-base font-semibold text-mist-100">
                {title}
              </h2>
              {subtitle && <div className="mt-1 text-xs text-mist-400">{subtitle}</div>}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-lg border border-ink-600 bg-ink-800 p-2 text-mist-300 transition hover:border-ink-500 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <footer className="border-t border-ink-700/80 bg-ink-900/95 px-5 py-3">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
