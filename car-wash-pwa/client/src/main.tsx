import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initSentry } from './lib/sentry';
import App from './App';
import './index.css';

initSentry();

// React Query defaults tuned for near-real-time feel:
//   staleTime 30s    — anything fetched is considered stale after half a
//                      minute, so the next render refetches.
//   gcTime   5min    — but we keep it in memory long enough that tab
//                      switches don't show blank loaders.
//   refetchOnWindowFocus: coming back to the tab refetches stale queries.
//   refetchOnReconnect   : network comes back → refresh.
//   refetchOnMount 'always': mounting a component always rechecks freshness.
// Per-query hooks can still pass a longer staleTime for rarely-changing
// data (e.g. the storefront gallery uses 5min).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: 'always',
    },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                fontFamily: 'Tajawal, sans-serif',
                direction: 'rtl',
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
              },
              success: { iconTheme: { primary: '#38bdf8', secondary: '#0f172a' } },
              error: { iconTheme: { primary: '#f87171', secondary: '#0f172a' } },
            }}
          />
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
