import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    console.log('⚠️  SENTRY_DSN غير موجود — تتبع الأخطاء معطل');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: `jdawil-server@${process.env.npm_package_version ?? '1.0.0'}`,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    beforeSend(event) {
      // Strip sensitive data
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });

  console.log('✅ Sentry error tracking مفعّل');
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!dsn) return;
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
