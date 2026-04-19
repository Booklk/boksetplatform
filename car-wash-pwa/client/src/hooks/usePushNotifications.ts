import { useState, useEffect, useCallback } from 'react';

const SUBSCRIBED_KEY = 'push-subscribed';

export interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// Convert a URL-safe base64 string to a Uint8Array (needed for VAPID key)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

async function getVapidPublicKey(): Promise<string> {
  // Prefer build-time env var; fall back to runtime fetch
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (envKey) return envKey;

  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return '';
    const data = await res.json();
    return (data.publicKey as string) ?? '';
  } catch {
    return '';
  }
}

async function getAuthToken(): Promise<string | null> {
  // Pull token from whatever key useAuth stores it under
  return (
    localStorage.getItem('token') ??
    sessionStorage.getItem('token') ??
    null
  );
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [isSubscribed, setIsSubscribed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SUBSCRIBED_KEY) === '1';
  });
  const [isLoading, setIsLoading] = useState(false);

  // On mount, verify the actual subscription state with the browser
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        const active = sub !== null;
        setIsSubscribed(active);
        if (active) {
          localStorage.setItem(SUBSCRIBED_KEY, '1');
        } else {
          localStorage.removeItem(SUBSCRIBED_KEY);
        }
      })
      .catch(() => {
        // Ignore errors during check
      });
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      // 1. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setIsLoading(false);
        return;
      }

      // 2. Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key
      const vapidPublicKey = await getVapidPublicKey();

      // 4. Subscribe to push
      const subscribeOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      if (vapidPublicKey) {
        subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as Uint8Array<ArrayBuffer>;
      }

      const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
      const subJson = pushSubscription.toJSON();

      // 5. POST subscription to backend
      const token = await getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          deviceType: 'web',
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        localStorage.setItem(SUBSCRIBED_KEY, '1');
      } else {
        // If backend fails, unsubscribe from browser too
        await pushSubscription.unsubscribe();
      }
    } catch (err) {
      console.error('[usePushNotifications] subscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();

      if (pushSubscription) {
        // Notify backend
        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch('/api/push/unsubscribe', {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
        });

        // Unsubscribe from browser PushManager
        await pushSubscription.unsubscribe();
      }

      setIsSubscribed(false);
      localStorage.removeItem(SUBSCRIBED_KEY);
    } catch (err) {
      console.error('[usePushNotifications] unsubscribe error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
