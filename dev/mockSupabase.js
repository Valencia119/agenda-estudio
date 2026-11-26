// Modo demo (npm run demo): reemplaza Supabase por datos de ejemplo en el navegador.
// Sirve para probar la interfaz sin cuenta ni internet. No se usa en la app publicada.
const KEY = 'agenda-demo-db-v2';
const uid = 'demo-user';
const now = () => new Date().toISOString();

function seed() {
  const d = (days, h, m = 0) => {
    const x = new Date();
    x.setDate(x.getDate() + days);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const c = (id, name, phone, instagram) => ({ id, user_id: uid, name, phone, instagram, email: null, notes: null, created_at: now(), updated_at: now() });
  const clients = [
    c('c1', 'Ana María Gómez', '3001234567', '@anamaria'),
    c('c2', 'Familia Rodríguez', '3109876543', null),
    c('c3', 'Laura Torres', '3157654321', '@lau.torres'),
    c('c4', 'Café Origen', '6015551234', '@cafeorigen')
  ];
  const a = (id, fields) => ({
    id, user_id: uid, client_id: null, kind: 'sesion', session_type: null, end_at: null, location: null, address: null,
    price: null, paid: 0, status: 'pendiente', notes: null, reminders: [1440, 120, 30], created_at: now(), updated_at: now(), ...fields
  });
  const appointments = [
    a('a1', { client_id: 'c1', title: 'Sesión preboda · Ana María', session_type: 'Pareja', start_at: d(0, 9), end_at: d(0, 11), location: 'Parque de la 93', address: 'Calle 93 #11-27, Bogotá', price: 650000, paid: 300000, status: 'confirmada', notes: 'Llevar reflector dorado y vestido rojo.' }),
    a('a2', { client_id: 'c2', title: 'Visita · Familia Rodríguez', kind: 'visita', start_at: d(0, 15, 30), location: 'Estudio', status: 'pendiente' }),
    a('a3', { client_id: 'c3', title: 'Entrega álbum XV · Laura', kind: 'entrega', session_type: 'XV años', start_at: d(1, 11), price: 1200000, paid: 1200000, status: 'realizada' }),
    a('a4', { client_id: 'c4', title: 'Fotos de producto · Café Origen', session_type: 'Producto', start_at: d(2, 8), end_at: d(2, 12), location: 'Café Origen', address: 'Carrera 7 #45-10, Bogotá', price: 900000, paid: 0 }),
    a('a5', { title: 'Comprar fondos de papel', kind: 'otro', start_at: d(3, 17), reminders: [60] }),
    a('a6', { client_id: 'c1', title: 'Boda Ana María y Juan', session_type: 'Boda', kind: 'salida', start_at: d(9, 14), end_at: d(9, 23), location: 'Hacienda El Roble', address: 'Chía, Cundinamarca', price: 4500000, paid: 1500000, status: 'confirmada' }),
    a('a7', { client_id: 'c2', title: 'Sesión familiar · Rodríguez', session_type: 'Familiar', start_at: d(-5, 10), price: 450000, paid: 450000, status: 'entregada' })
  ];
  for (const x of clients) x.studio_id = 's1';
  const owners = { a1: uid, a2: 'u2', a3: uid, a4: 'u2', a5: null, a6: uid, a7: 'u2' };
  for (const x of appointments) Object.assign(x, { studio_id: 's1', assigned_to: owners[x.id], user_id: owners[x.id] || uid });
  const studios = [{ id: 's1', name: 'Estudio Luz', invite_code: 'A1B2C3D4E5', created_by: uid }];
  const studio_members = [
    { studio_id: 's1', user_id: uid, display_name: 'Andrea', color: '#b5523b', role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
    { studio_id: 's1', user_id: 'u2', display_name: 'Alejandra', color: '#4c72a0', role: 'member', joined_at: '2026-01-02T00:00:00Z' }
  ];
  return { clients, appointments, settings: [], push_subscriptions: [], studios, studio_members };
}

let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* */ } };

const DEFAULTS = {
  settings: { timezone: 'America/Bogota', currency: 'COP', country_code: '57', morning_enabled: true, morning_time: '07:00:00', evening_enabled: true, evening_time: '20:00:00', default_reminders: [1440, 120, 30], last_morning_date: null, last_evening_date: null },
  appointments: { client_id: null, kind: 'sesion', session_type: null, end_at: null, location: null, address: null, price: null, paid: 0, status: 'pendiente', notes: null, reminders: [1440, 120, 30] },
  clients: { phone: null, email: null, instagram: null, notes: null }
};

class Query {
  constructor(table) { this.t = table; this.op = 'select'; this.filters = []; this.mode = 'many'; }
  select() { return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === v); return this; }
  is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  order(c, o) { this.ord = [c, o?.ascending !== false]; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(res, rej) { return new Promise((r) => setTimeout(r, 120)).then(() => this.run()).then(res, rej); }
  run() {
    const rows = (db[this.t] ||= []);
    const match = (r) => this.filters.every((f) => f(r));
    let out;
    if (this.op === 'insert' && this.t === 'settings' && rows.some((r) => r.user_id === uid)) {
      return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "settings_pkey"' } };
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      out = [].concat(this.payload).map((p) => {
        const ex = this.op === 'upsert' && rows.find((r) => r.endpoint === p.endpoint);
        if (ex) return Object.assign(ex, p);
        const row = { id: crypto.randomUUID(), user_id: uid, created_at: now(), updated_at: now(), ...DEFAULTS[this.t], ...p };
        rows.push(row);
        return row;
      });
    } else if (this.op === 'update') {
      out = rows.filter(match);
      out.forEach((r) => Object.assign(r, this.payload, { updated_at: now() }));
    } else if (this.op === 'delete') {
      out = rows.filter(match);
      db[this.t] = rows.filter((r) => !match(r));
      if (this.t === 'clients') db.appointments.forEach((a) => { if (out.some((c) => c.id === a.client_id)) a.client_id = null; });
    } else {
      out = rows.filter(match);
      if (this.ord) {
        const [c, asc] = this.ord;
        out = [...out].sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (asc ? 1 : -1));
      }
      if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
    }
    persist();
    const copy = JSON.parse(JSON.stringify(out));
    if (this.mode === 'single') return copy[0] ? { data: copy[0], error: null } : { data: null, error: { message: 'No encontrado' } };
    if (this.mode === 'maybe') return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null };
  }
}

const session = { user: { id: uid, email: 'demo@agenda.local' } };
let listeners = [];
const channel = { on() { return channel; }, subscribe() { return channel; } };

export const configured = true;
export const supabase = {
  from: (t) => new Query(t),
  rpc: async (fn) => {
    if (fn === 'ensure_studio') return { data: 's1', error: null };
    if (fn === 'join_studio') return { data: { studio_id: 's1', name: 'Estudio Luz', already: true }, error: null };
    if (fn === 'new_invite_code') {
      db.studios[0].invite_code = Math.random().toString(16).slice(2, 12).toUpperCase();
      persist();
      return { data: db.studios[0].invite_code, error: null };
    }
    return { data: null, error: { message: 'rpc desconocida' } };
  },
  channel: () => channel,
  removeChannel: () => {},
  functions: { invoke: async () => ({ data: { sent: 1 }, error: null }) },
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() { listeners = listeners.filter((l) => l !== cb); } } } }; },
    signOut: async () => { localStorage.removeItem(KEY); location.reload(); }
  }
};
