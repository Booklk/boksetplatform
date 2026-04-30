import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `jdawil-client@1.0.0`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Trace outbound fetches to the API — ties client errors to the
    // matching server trace.
    tracePropagationTargets: [/^\//, /\/api\//],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['Authorization'];
      }
      return event;
    },
  });
}

/** Attach the current user to subsequent Sentry events.
 *  Call on login / whenever the user identity changes. */
export function setSentryUser(u: { id: number; role?: string; vendorId?: number | null } | null) {
  if (!dsn) return;
  if (!u) { Sentry.setUser(null); return; }
  Sentry.setUser({
    id: String(u.id),
    // keep it privacy-minimal: role + vendorId only, no PII
    segment: u.role,
    vendorId: u.vendorId ?? undefined,
  } as unknown as Sentry.User);
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!dsn) return;
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, String(val));
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
