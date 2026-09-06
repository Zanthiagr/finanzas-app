import { guardarSuscripcionPush, eliminarSuscripcionPush } from './api';

// Llave PÚBLICA de VAPID — es seguro tenerla directamente en el código
// del frontend (así funciona el estándar Web Push: identifica a nuestro
// servidor ante el navegador, no da ningún permiso de envío por sí sola).
// La llave PRIVADA correspondiente, esa sí secreta, vive únicamente como
// secreto de la Edge Function `recordatorio-nocturno` — nunca aquí.
const VAPID_PUBLIC_KEY = 'BPXHtik8vW07sfaFxepAqpBaIeyzavIdrJEasf5Ong_gDOmDZNhr6Ff__s5GTq5FhzoWIJZPo6uWoxUfh0-GIlM';

// El navegador espera la llave VAPID como Uint8Array, no como el string
// base64url que entrega la herramienta que la generó — esta conversión
// es el puente estándar entre ambos formatos.
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
};

// Chequeo de soporte real del navegador/plataforma. En iPhone, Safari
// solo expone estas APIs cuando la app fue agregada a la pantalla de
// inicio (modo standalone) — en una pestaña normal de Safari, esto da
// false aunque el iOS sea reciente.
export const pushSoportado = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// Pide el permiso del sistema operativo, se suscribe a push (o reutiliza
// la suscripción existente de este navegador) y la guarda en Supabase.
export const activarRecordatorioNocturno = async () => {
  if (!pushSoportado()) {
    throw new Error(
      'Este navegador no soporta notificaciones. En iPhone: agrega Fintual a tu pantalla de inicio primero (Compartir → Agregar a inicio).'
    );
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('Necesitas aceptar el permiso de notificaciones del navegador para activar el recordatorio.');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { endpoint, keys } = subscription.toJSON();
  await guardarSuscripcionPush({ endpoint, p256dh: keys.p256dh, authKey: keys.auth });
};

// Borra la suscripción tanto en Supabase como en el navegador. Si el
// usuario nunca se suscribió en este dispositivo, no hace nada.
export const desactivarRecordatorioNocturno = async () => {
  if (!pushSoportado()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription.toJSON();
  await eliminarSuscripcionPush(endpoint);
  await subscription.unsubscribe();
};
