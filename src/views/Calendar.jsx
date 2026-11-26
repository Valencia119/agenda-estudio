import { useMemo, useState } from 'react';
import AppointmentCard from '../components/AppointmentCard.jsx';
import { Empty, Icon } from '../components/ui.jsx';
import { addDays, dayKey, fmtDayLong, fmtMonth, startOfDay } from '../lib/format.js';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export default function Calendar({ appointments, clients, settings, now, filterBar, selected, setSelected, onOpen, onNew }) {
  const [month, setMonth] = useState(() => {
    const d = new Date(selected);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const currency = settings?.currency || 'COP';
  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const byDay = useMemo(() => {
    const m = new Map();
    for (const a of appointments) {
      const k = dayKey(a.start_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    return m;
  }, [appointments]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const start = addDays(first, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const todayKey = dayKey(now);
  const selKey = dayKey(selected);
  const dayList = byDay.get(selKey) || [];

  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const goToday = () => {
    const t = startOfDay(new Date());
    setSelected(t);
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  };

  return (
    <div className="view">
      <header className="view-head row-between">
        <h1>{fmtMonth(month)}</h1>
        <div className="row">
          <button className="btn btn-soft btn-sm" onClick={goToday}>Hoy</button>
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior"><Icon name="left" /></button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente"><Icon name="right" /></button>
        </div>
      </header>

      {filterBar}

      <div className="month">
        {WEEKDAYS.map((w, i) => <div key={i} className="month-wd">{w}</div>)}
        {cells.map((d) => {
          const k = dayKey(d);
          const items = (byDay.get(k) || []).filter((a) => a.status !== 'cancelada');
          const outside = d.getMonth() !== month.getMonth();
          return (
            <button key={k}
              className={`month-day ${outside ? 'outside' : ''} ${k === todayKey ? 'today' : ''} ${k === selKey ? 'selected' : ''}`}
              onClick={() => { setSelected(d); if (outside) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
              aria-label={`${fmtDayLong(d)}${items.length ? `, ${items.length} citas` : ''}`}>
              <span className="month-num">{d.getDate()}</span>
              <span className="dots">
                {items.slice(0, 3).map((a) => <i key={a.id} className={`dot kind-${a.kind}`} />)}
                {items.length > 3 && <i className="dot-more">+</i>}
              </span>
            </button>
          );
        })}
      </div>

      <section className="day-section">
        <div className="row-between">
          <h2 className="section-title">{fmtDayLong(selected)}</h2>
          <button className="btn btn-soft btn-sm" onClick={() => onNew(selected)}><Icon name="plus" size={16} /> Agendar</button>
        </div>
        {dayList.length ? (
          <div className="list">
            {dayList.map((a) => (
              <AppointmentCard key={a.id} appt={a} client={clientById[a.client_id]} currency={currency} onOpen={onOpen} now={now} />
            ))}
          </div>
        ) : <Empty icon="calendar" title="Día libre" text="No hay nada agendado este día." />}
      </section>
    </div>
  );
}
