import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Register PWA Service Worker silently in production without ever forcing a page reload
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: false,
      onNeedRefresh() {
        // Silent background update: never auto-reload or interrupt active Home state
      },
      onOfflineReady() {}
    });
  } else {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((reg) => {
        const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
        if (scriptUrl.includes('dev-sw.js')) {
          reg.unregister().catch(() => {});
        }
      });
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
