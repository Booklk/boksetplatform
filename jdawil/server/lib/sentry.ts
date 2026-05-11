/**
 * Sentry — error tracking + performance + per-request context.
 *
 * The init below runs once at boot. After that, the express middleware
 * (`sentryRequestContext`) tags every incoming request with vendor, user,
 * and route info so when an error fires we can answer "which vendor was
 * affected?" without grepping logs.
 *
 * Release tagging: GIT_COMMIT (set during deploy) is preferred over the
 * package version because it pins errors to the exact code that was
 * running. Without it, Sentry groups errors across deploys and "did this
 * regression land in deploy X?" becomes impossible to answer.
 */
import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';

const dsn = process.env.SENTRY_DSN;

function resolveRelease(): string {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
  if (process.env.GIT_COMMIT) return `jdawil-server@${process.env.GIT_COMMIT.slice(0, 12)}`;
  return `jdawil-server@${process.env.npm_package_version ?? '1.0.0'}`;
}

const SAMPLE_RATE = process.env.NODE_ENV === 'production'
  ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05) // 5% by default at scale
  : 1.0;

export function initSentry() {
  if (!dsn) {
    console.log('⚠️  SENTRY_DSN غير موجود — تتبع الأخطاء معطل');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: resolveRelease(),
    tracesSampleRate: SAMPLE_RATE,
    // Capture unhandled rejections + uncaught exceptions automatically.
    integrations: [],
    beforeSend(event) {
      // Strip sensitive headers regardless of where they come from.
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      // Drop noisy 4xx that aren't actually our bugs.
      const status = event.contexts?.response?.status_code;
      if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
        return null;
      }
      return event;
    },
  });

  console.log(`✅ Sentry error tracking مفعّل (release=${resolveRelease()}, sample=${SAMPLE_RATE})`);
}

/**
 * Express middleware — every request gets a Sentry scope with vendor +
 * user + route tags. When an error fires later in this request the
 * Sentry payload already has the context we'd want to filter by.
 */
export function sentryRequestContext(req: Request, _res: Response, next: NextFunction) {
  if (!dsn) return next();
  const auth = req as AuthRequest;
  Sentry.getCurrentScope().setTags({
    'http.method': req.method,
    'http.route': req.route?.path ?? req.path,
    'user.role': auth.user?.role ?? 'anonymous',
    'vendor.id': String(auth.user?.vendorId ?? 'none'),
  });
  if (auth.user) {
    Sentry.getCurrentScope().setUser({
      id: String(auth.user.id),
      role: auth.user.role,
    });
  }
  next();
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

/** Add a breadcrumb for context that helps when an error fires later. */
export function breadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

export { Sentry };
