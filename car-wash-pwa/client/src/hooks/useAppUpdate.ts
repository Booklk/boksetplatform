/**
 * useAppUpdate — detect a new service-worker version and give the
 * vendor a gentle "update" nudge.
 *
 * With `skipWaiting: true + clientsClaim: true` set in vite.config.ts,
 * the new SW activates automatically, but the currently-mounted React
 * tree is still running the old JS bundle. This hook listens for
 * `controllerchange` (new SW took over) and offers a one-click reload
 * so the UI catches up.
 *
 * We also auto-trigger a reload when the tab regains focus after an
 * update was detected — the intent is "fresh data, always" without
 * dropping anything the user was mid-typing.
 */

import { useEffect, useState } from 'react';

export interface AppUpdateState {
  updateAvailable: boolean;
  apply: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      // New SW is in charge. If the user isn't actively typing, reload
      // now; otherwise just surface the toast and let them click.
      const active = document.activeElement;
      const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (!typing) {
        window.location.reload();
        return;
      }
      setUpdateAvailable(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Also poll the registration every 5 minutes so a long-idle tab
    // picks up newly-deployed code without the user having to refresh.
    const poll = window.setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      } catch { /* ignore */ }
    }, 5 * 60 * 1000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(poll);
    };
  }, []);

  const apply = () => window.location.reload();

  return { updateAvailable, apply };
}
