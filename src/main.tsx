import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initSmoothAppUpdates } from './utils/appUpdater.ts';

// Initialize smooth Service Worker & server build version auto-updates
initSmoothAppUpdates();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
