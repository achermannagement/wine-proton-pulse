import { BrowserRouter } from 'react-router-dom';
import { DashboardProvider } from './hooks/DashboardProvider';
import { AppShell } from './components/AppShell';

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <AppShell />
      </DashboardProvider>
    </BrowserRouter>
  );
}
