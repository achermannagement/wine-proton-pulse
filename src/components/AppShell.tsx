import { Route, Routes } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { Toast } from './Toast';
import { FeedView } from '../views/FeedView';
import { GamesView } from '../views/GamesView';
import { ReleasesView } from '../views/ReleasesView';
import { SourcesView } from '../views/SourcesView';
import { NotFoundView } from '../views/NotFoundView';

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 lg:px-6">
        <Routes>
          <Route path="/" element={<FeedView />} />
          <Route path="/games" element={<GamesView />} />
          <Route path="/releases" element={<ReleasesView />} />
          <Route path="/sources" element={<SourcesView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </main>
      <Footer />
      <Toast />
    </div>
  );
}
