/**
 * Native shell entry point.
 *
 * Loads the vendor's PWA storefront inside the native container. The
 * Capacitor plugins (Push, Haptics, Share, etc.) are reachable from the
 * web context via window.Capacitor — the storefront detects this and
 * upgrades its native-only flows (push subscribe, native share sheet).
 */
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const STORE_URL = '{{VENDOR_STORE_URL}}';

const iframe = document.getElementById('store') as HTMLIFrameElement;
const loading = document.getElementById('loading') as HTMLDivElement;

iframe.src = STORE_URL;

iframe.addEventListener('load', () => {
  iframe.classList.add('loaded');
  setTimeout(() => { loading.style.display = 'none'; }, 400);
  SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
});

// Handle Android back button: navigate the iframe back if it has history,
// otherwise minimise the app (don't quit — feels iOS-like).
App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) {
    history.back();
  } else {
    iframe.contentWindow?.history?.back?.();
    App.minimizeApp().catch(() => {});
  }
});

// Push notification registration — only on native, only after the
// storefront signals it's ready (so we don't prompt before the user
// has even seen the screen).
async function registerPush() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;
    await PushNotifications.register();

    PushNotifications.addListener('registration', (token) => {
      // Send the FCM/APNs token back to the storefront so it can store
      // it against the vendor's customer record for targeted pushes.
      iframe.contentWindow?.postMessage(
        { type: 'jdawil:push-token', token: token.value },
        new URL(STORE_URL).origin,
      );
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (evt) => {
      const url = (evt.notification.data as Record<string, string>)?.url;
      if (url && iframe.contentWindow) {
        iframe.contentWindow.location.href = url;
      }
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] registration failed', e);
  }
}

// Storefront announces readiness via postMessage — gate push prompts on it.
window.addEventListener('message', (event) => {
  if (event.origin !== new URL(STORE_URL).origin) return;
  const data = event.data as { type?: string };
  if (data?.type === 'jdawil:ready') registerPush();
});
