import * as Sentry from '@sentry/node';

let initialized = false;

export async function initSentry() {
  if (initialized) return;
  // Lazy import so a startup failure here can't break the app
  let dsn: string | null = null;
  try {
    const { getSetting } = await import('../services/platformSettings.js');
    dsn = await getSetting('sentry.dsn');
  } catch {
    dsn = process.env.SENTRY_DSN ?? null;
  }

  if (!dsn) {
    console.log('⚠️  SENTRY_DSN غير موجود — تتبع الأخطاء معطل');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: `boksetplatform-server@${process.env.npm_package_version ?? '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  initialized = true;
  console.log('✅ Sentry error tracking مفعّل');
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!initialized) return;
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, val]) => {
        scope.setExtra(key, val);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

export { Sentry };
