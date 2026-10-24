import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export function NotFoundView() {
  usePageTitle('Not found');
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="rounded-2xl border border-ink-700 bg-ink-850/60 p-6">
        <Compass className="mx-auto h-8 w-8 text-proton-400" aria-hidden="true" />
        <h1 className="mt-3 text-xl font-semibold text-mist-100">Page not found</h1>
        <p className="mt-1 text-sm text-mist-400">
          That route does not exist. The pulse is back on the feed.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg border border-proton-500/40 bg-proton-500/10 px-4 py-2 text-sm font-medium text-proton-200 transition hover:border-proton-400/60 hover:text-white"
        >
          Back to the feed
        </Link>
      </div>
    </div>
  );
}
