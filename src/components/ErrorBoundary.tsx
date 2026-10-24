import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected rendering error',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-ink-900 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-300" aria-hidden="true" />
            <h1 className="mt-3 text-lg font-semibold text-mist-100">Something went wrong</h1>
            <p className="mt-2 text-sm text-mist-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg border border-ink-600 bg-ink-800 px-4 py-2 text-sm text-mist-200 hover:text-white"
            >
              Reload dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
