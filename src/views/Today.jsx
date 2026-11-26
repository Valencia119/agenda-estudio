import { useMemo } from 'react';
import AppointmentCard from '../components/AppointmentCard.jsx';
import { Empty, Icon } from '../components/ui.jsx';
import { addDays, balanceOf, dayKey, fmtDayLong, greeting, money, moneyShort, relativeDay, startOfDay } from '../lib/format.js';

export default function Today({ appointments, clients, settings, now, banner, filterBar, onOpen, onNew }) {
  const currency = settings?.currency || 'COP';
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const { today, tomorrow, upcoming, weekCount, owed } = useMemo(() => {
    const t0 = startOfDay(new Date(now));
    const kToday = dayKey(t0);
    const kTomorrow = dayKey(addDays(t0, 1));
    const limit = addDays(t0, 15).getTime();
    const weekEnd = addDays(t0, 7).getTime();
    const today = [];
    const tomorrow = [];
    const upcoming = [];
    let weekCount = 0;
    let owed = 0;
    for (const a of appointments) {
      const ts = new Date(a.start_at).getTime();
      const k = dayKey(a.start_at);
      if (a.status !== 'cancelada') owed += balanceOf(a);
      if (k === kToday) today.push(a);
      else if (k === kTomorrow) tomorrow.push(a);
      else if (ts > t0.getTime() && ts < limit) upcoming.push(a);
      if (ts >= t0.getTime() && ts < weekEnd && a.status !== 'cancelada') weekCount++;
    }
    return { today, tomorrow, upcoming, weekCount, owed };
  }, [appointments, now]);

  const groups = useMemo(() => {
    const g = new Map();
    for (const a of upcoming) {
      const k = dayKey(a.start_at);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(a);
    }
    return [...g.entries()];
  }, [upcoming]);

  const card = (a) => (
    <AppointmentCard key={a.id} appt={a} client={clientById[a.client_id]} currency={currency} onOpen={onOpen} now={now} />
  );
  const activeToday = today.filter((a) => a.status !== 'cancelada');

  return (
    <div className="view">
      <header className="view-head">
        <p className="eyebrow">{fmtDayLong(now)}</p>
        <h1>{greeting()} ✨</h1>
      </header>

      {banner}
      {filterBar}

      <div className="stats">
        <div className="stat"><span className="stat-num">{activeToday.length}</span><span className="stat-label">Hoy</span></div>
        <div className="stat"><span className="stat-num">{weekCount}</span><span className="stat-label">Próximos 7 días</span></div>
        <div className="stat"><span className="stat-num stat-money" title={money(owed, currency)}>{moneyShort(owed, currency)}</span><span className="stat-label">Por cobrar</span></div>
      </div>

      <section className="day-section">
        <h2 className="section-title">Hoy</h2>
        {today.length ? <div className="list">{today.map(card)}</div> : (
          <Empty icon="today" title="Nada agendado para hoy" text="Toca + para anotar una sesión, visita o pendiente."
            action={<button className="btn btn-soft" onClick={() => onNew(new Date())}><Icon name="plus" size={18} /> Agendar para hoy</button>} />
        )}
      </section>

      <section className="day-section">
        <h2 className="section-title">Mañana</h2>
        {tomorrow.length ? <div className="list">{tomorrow.map(card)}</div> : <p className="muted pad">Sin citas mañana.</p>}
      </section>

      {groups.length > 0 && (
        <section className="day-section">
          <h2 className="section-title">Próximos días</h2>
          {groups.map(([k, list]) => (
            <div key={k} className="day-group">
              <h3 className="day-label">{relativeDay(list[0].start_at)}</h3>
              <div className="list">{list.map(card)}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
