import { supabase } from '../supabase.js';

export const isIOS =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// true cuando corre dentro del programa de Windows (.exe)
export const isDesktopApp = Boolean(window.agendaDesktop);

export const pushSupported = () =>
  !isDesktopApp && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlB64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function getPushState() {
  if (isDesktopApp) return 'desktop';
  if (!pushSupported()) return isIOS && !isStandalone ? 'ios-needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(userId) {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('No diste permiso para las notificaciones.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID)
    });
  }
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

// vuelve a registrar la suscripción por si el navegador la renovó
export async function refreshPushSubscription(userId) {
  try {
    if ((await getPushState()) === 'on') await enablePush(userId);
  } catch { /* silencioso */ }
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } });
  if (error) throw error;
  return data?.sent ?? 0;
}
