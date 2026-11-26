// Recordatorios locales para el programa de Windows (.exe).
// En Windows la app queda abierta en la bandeja del sistema y revisa cada 30 s.
import { KINDS, dayKey, addDays, fmtTime, reminderLabel } from './format.js';

const KEY = 'agenda-desktop-fired';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const save = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* */ }
};

function whenText(m) {
  if (m === 0) return 'Ahora';
  if (m === 1440) return 'Mañana';
  return `En ${reminderLabel(m)}`;
}

export function checkDesktopReminders({ appointments, clients, settings }) {
  if (!window.agendaDesktop || !settings) return;
  const now = Date.now();
  const fired = load();
  const clientName = (id) => clients.find((c) => c.id === id)?.name;

  for (const a of appointments) {
    if (a.status === 'cancelada') continue;
    const start = new Date(a.start_at).getTime();
    if (start < now - 3600e3) continue;
    for (const m of a.reminders || []) {
      const fireAt = start - m * 60e3;
      const key = `${a.id}:${m}:${a.start_at}`;
      if (now >= fireAt && now - fireAt < 15 * 60e3 && !fired[key]) {
        fired[key] = now;
        const place = a.location || a.address;
        const who = clientName(a.client_id);
        window.agendaDesktop.notify(
          `${KINDS[a.kind]?.emoji ?? '📌'} ${whenText(m)}: ${a.title}`,
          [`🕒 ${fmtTime(a.start_at)}`, place && `📍 ${place}`, who && `👤 ${who}`].filter(Boolean).join('  ·  ')
        );
      }
    }
  }

  // resúmenes de la mañana y de la noche
  const today = dayKey(new Date());
  const minutesNow = new Date().getHours() * 60 + new Date().getMinutes();
  const toMin = (t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + m;
  };
  const summary = (kind, enabled, time, target, word, icon) => {
    const k = `summary-${kind}-${today}`;
    if (!enabled || fired[k]) return;
    const t = toMin(time);
    if (minutesNow < t || minutesNow >= t + 120) return;
    fired[k] = now;
    const list = appointments.filter((a) => a.status !== 'cancelada' && dayKey(a.start_at) === target);
    window.agendaDesktop.notify(
      list.length ? `${icon} ${word} tienes ${list.length} ${list.length === 1 ? 'cita' : 'citas'}` : `${icon} ${word} no tienes citas agendadas`,
      list.slice(0, 6).map((a) => `${fmtTime(a.start_at)} ${KINDS[a.kind]?.emoji ?? ''} ${a.title}`).join('\n') ||
        'Abre la agenda si quieres anotar algo nuevo.'
    );
  };
  summary('morning', settings.morning_enabled, settings.morning_time, today, 'Hoy', '☀️');
  summary('evening', settings.evening_enabled, settings.evening_time, dayKey(addDays(new Date(), 1)), 'Mañana', '🌙');

  // limpia registros viejos
  for (const k of Object.keys(fired)) if (now - fired[k] > 14 * 86400e3) delete fired[k];
  save(fired);
}
