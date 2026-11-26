// Edge Function: envía las notificaciones push.
// - La llama pg_cron cada minuto (header x-cron-key) → recordatorios de citas + resúmenes diarios.
// - La app la llama con { test: true } (con la sesión de la usuaria) → notificación de prueba.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'https://github.com';
const APP_URL = Deno.env.get('APP_URL') ?? '/';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const KIND_EMOJI: Record<string, string> = { sesion: '📸', visita: '🤝', salida: '🚗', entrega: '🎁', otro: '📌' };

type Payload = { title: string; body: string; tag: string; url?: string };

// ---------------- helpers de fecha (en la zona horaria de la usuaria) ----------------
function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('es', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d);
const fmtDay = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('es', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

function whenLabel(minutes: number, start: Date, tz: string) {
  if (minutes === 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  if (minutes < 1440) {
    const h = Math.round(minutes / 60);
    return `En ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  if (minutes === 1440) return 'Mañana';
  const days = Math.round(minutes / 1440);
  if (days === 7) return 'En 1 semana';
  return `${fmtDay(start, tz).replace(/^./, (c) => c.toUpperCase())} (en ${days} días)`;
}

// ---------------- envío ----------------
async function sendToUser(userId: string, payload: Payload) {
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, url: payload.url ?? APP_URL }),
        { TTL: 60 * 60 * 6, urgency: 'high' }
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await db.from('push_subscriptions').delete().eq('id', s.id); // dispositivo ya no existe
      } else {
        console.error('push error', code, (e as Error).message);
      }
    }
  }
  return sent;
}

async function loadSettings() {
  const { data } = await db.from('settings').select('*');
  const map = new Map<string, Record<string, any>>();
  for (const s of data ?? []) map.set(s.user_id, s);
  return map;
}

// ---------------- recordatorios de citas ----------------
async function processAppointmentReminders(settings: Map<string, Record<string, any>>) {
  const now = new Date();
  const oldest = new Date(now.getTime() - 2 * 60 * 60 * 1000); // no envía avisos con más de 2 h de retraso

  const { data: due } = await db
    .from('scheduled_reminders')
    .select('id')
    .is('sent_at', null)
    .lte('fire_at', now.toISOString())
    .gte('fire_at', oldest.toISOString())
    .limit(200);
  if (!due?.length) return 0;

  // "reclama" los avisos para que nunca se envíen dos veces
  const { data: claimed } = await db
    .from('scheduled_reminders')
    .update({ sent_at: now.toISOString() })
    .in('id', due.map((d) => d.id))
    .is('sent_at', null)
    .select('id, user_id, minutes_before, appointment:appointments(id, title, kind, start_at, location, address, status, client:clients(name))');

  let count = 0;
  for (const r of claimed ?? []) {
    const a = r.appointment as any;
    if (!a || a.status === 'cancelada') continue;
    const tz = settings.get(r.user_id)?.timezone ?? 'America/Bogota';
    const start = new Date(a.start_at);
    const emoji = KIND_EMOJI[a.kind] ?? '📌';
    const place = a.location || a.address;
    const body = [
      `🕒 ${fmtTime(start, tz)}`,
      place ? `📍 ${place}` : null,
      a.client?.name ? `👤 ${a.client.name}` : null
    ].filter(Boolean).join('  ·  ');
    await sendToUser(r.user_id, {
      title: `${emoji} ${whenLabel(r.minutes_before, start, tz)}: ${a.title}`,
      body,
      tag: `appt-${a.id}-${r.minutes_before}`
    });
    count++;
  }
  return count;
}

// ---------------- resúmenes diarios ----------------
async function processDailySummaries(settings: Map<string, Record<string, any>>) {
  const now = new Date();
  let count = 0;
  for (const s of settings.values()) {
    const tz = s.timezone || 'America/Bogota';
    const local = localParts(now, tz);
    const tomorrowDate = localParts(new Date(now.getTime() + 24 * 3600 * 1000), tz).date;

    const jobs: { kind: 'morning' | 'evening'; targetDate: string }[] = [];
    const inWindow = (t: string) => {
      const m = timeToMinutes(t);
      return local.minutes >= m && local.minutes < m + 120; // ventana de 2 h por si el servidor se atrasa
    };
    if (s.morning_enabled && s.last_morning_date !== local.date && inWindow(s.morning_time)) {
      jobs.push({ kind: 'morning', targetDate: local.date });
    }
    if (s.evening_enabled && s.last_evening_date !== local.date && inWindow(s.evening_time)) {
      jobs.push({ kind: 'evening', targetDate: tomorrowDate });
    }
    if (!jobs.length) continue;

    const { data: appts } = await db
      .from('appointments')
      .select('id, title, kind, start_at, location, status, client:clients(name)')
      .eq('user_id', s.user_id)
      .neq('status', 'cancelada')
      .gte('start_at', new Date(now.getTime() - 36 * 3600 * 1000).toISOString())
      .lte('start_at', new Date(now.getTime() + 60 * 3600 * 1000).toISOString())
      .order('start_at');

    for (const job of jobs) {
      // marca primero para no duplicar si el cron corre dos veces
      const column = job.kind === 'morning' ? 'last_morning_date' : 'last_evening_date';
      const { data: marked } = await db
        .from('settings')
        .update({ [column]: local.date })
        .eq('user_id', s.user_id)
        .or(`${column}.is.null,${column}.neq.${local.date}`)
        .select('user_id');
      if (!marked?.length) continue;

      const list = (appts ?? []).filter((a) => localParts(new Date(a.start_at), tz).date === job.targetDate);
      const dayWord = job.kind === 'morning' ? 'Hoy' : 'Mañana';
      const icon = job.kind === 'morning' ? '☀️' : '🌙';
      const lines = list.slice(0, 6).map((a: any) => {
        const who = a.client?.name ? ` (${a.client.name})` : '';
        return `${fmtTime(new Date(a.start_at), tz)} ${KIND_EMOJI[a.kind] ?? '📌'} ${a.title}${who}`;
      });
      if (list.length > 6) lines.push(`…y ${list.length - 6} más`);

      await sendToUser(s.user_id, {
        title: list.length
          ? `${icon} ${dayWord} tienes ${list.length} ${list.length === 1 ? 'cita' : 'citas'}`
          : `${icon} ${dayWord} no tienes citas agendadas`,
        body: list.length ? lines.join('\n') : 'Abre la agenda si quieres anotar algo nuevo.',
        tag: `summary-${job.kind}-${local.date}`
      });
      count++;
    }
  }
  return count;
}

// ---------------- entrada ----------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }

  // 1) Notificación de prueba pedida desde la app
  if (body.test) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: 'No autorizado' }, 401);
    const sent = await sendToUser(user.id, {
      title: '✅ ¡Recordatorios activados!',
      body: 'Así te llegarán los avisos de tus sesiones y citas.',
      tag: 'test'
    });
    return json({ sent });
  }

  // 2) Llamada del cron
  const { data: cfg } = await db.from('cron_config').select('secret').single();
  if (!cfg || req.headers.get('x-cron-key') !== cfg.secret) return json({ error: 'No autorizado' }, 401);

  const settings = await loadSettings();
  const reminders = await processAppointmentReminders(settings);
  const summaries = await processDailySummaries(settings);
  return json({ reminders, summaries });
});
