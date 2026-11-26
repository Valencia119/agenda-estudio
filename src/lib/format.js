// ---------- catálogos ----------
export const KINDS = {
  sesion: { label: 'Sesión de fotos', short: 'Sesión', emoji: '📸' },
  visita: { label: 'Visita / cita en el estudio', short: 'Visita', emoji: '🤝' },
  salida: { label: 'Salida / locación', short: 'Salida', emoji: '🚗' },
  entrega: { label: 'Entrega de fotos', short: 'Entrega', emoji: '🎁' },
  otro: { label: 'Otro pendiente', short: 'Otro', emoji: '📌' }
};

export const STATUSES = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  entregada: 'Fotos entregadas',
  cancelada: 'Cancelada'
};

export const SESSION_TYPES = [
  'Boda', 'XV años', 'Estudio / retrato', 'Familiar', 'Maternidad', 'Recién nacido',
  'Infantil', 'Pareja', 'Graduación', 'Producto', 'Corporativo', 'Evento',
  'Book / modelo', 'Mascotas'
];

export const REMINDER_OPTIONS = [
  { m: 10080, label: '1 semana' },
  { m: 2880, label: '2 días' },
  { m: 1440, label: '1 día' },
  { m: 180, label: '3 h' },
  { m: 120, label: '2 h' },
  { m: 60, label: '1 h' },
  { m: 30, label: '30 min' },
  { m: 15, label: '15 min' },
  { m: 0, label: 'A la hora' }
];

export const CURRENCIES = ['COP', 'USD', 'MXN', 'EUR', 'PEN', 'CLP', 'ARS', 'GTQ', 'CRC', 'DOP'];

export function reminderLabel(m) {
  const opt = REMINDER_OPTIONS.find((o) => o.m === m);
  if (opt) return opt.label;
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} días`;
}

// ---------- fechas (hora local del dispositivo) ----------
const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const timeKey = (d) => {
  const x = new Date(d);
  return `${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
export const fromKeys = (date, time) => {
  const [y, mo, da] = date.split('-').map(Number);
  const [h, mi] = (time || '00:00').split(':').map(Number);
  return new Date(y, mo - 1, da, h, mi);
};
export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const sameDay = (a, b) => dayKey(a) === dayKey(b);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmtTime = (d) =>
  new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export const fmtDayLong = (d) =>
  cap(new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d)));

export const fmtDayShort = (d) =>
  cap(new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d)));

export const fmtDate = (d) =>
  new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

export const fmtMonth = (d) =>
  cap(new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(d)));

export function relativeDay(d) {
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return fmtDayLong(d);
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ---------- dinero ----------
export function money(n, currency = 'COP') {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat('es', {
      style: 'currency', currency, maximumFractionDigits: v % 1 ? 2 : 0
    }).format(v);
  } catch {
    return `$${v.toLocaleString('es')}`;
  }
}
// versión corta para espacios pequeños: $4,3 M
export function moneyShort(n, currency = 'COP') {
  const v = Number(n || 0);
  if (Math.abs(v) < 100000) return money(v, currency);
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v);
  } catch {
    return money(v, currency);
  }
}
export const balanceOf = (a) => Math.max(0, Number(a.price || 0) - Number(a.paid || 0));

// ---------- enlaces ----------
export function waLink(phone, countryCode = '57', text = '') {
  if (!phone) return null;
  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (!raw.startsWith('+') && digits.length <= 10) digits = `${countryCode}${digits.replace(/^0+/, '')}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
export const telLink = (phone) => (phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : null);
export const mapsLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
export const wazeLink = (q) => `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
export const appleMapsLink = (q) => `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
export const igLink = (h) => (h ? `https://instagram.com/${String(h).replace(/^@/, '').trim()}` : null);
