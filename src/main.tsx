import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker in production; clean up any stale dev-sw.js in development
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({ immediate: true });
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

createRoot(document.getElementById('root')!).render(<App />);
