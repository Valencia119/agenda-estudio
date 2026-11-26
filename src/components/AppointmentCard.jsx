import { KINDS, STATUSES, balanceOf, fmtTime, money } from '../lib/format.js';
import { Icon } from './ui.jsx';

export default function AppointmentCard({ appt, client, currency, onOpen, showDate = false, now = Date.now() }) {
  const start = new Date(appt.start_at);
  const end = appt.end_at ? new Date(appt.end_at) : null;
  const inProgress = start.getTime() <= now && (end ? end.getTime() : start.getTime() + 3600e3) > now;
  const balance = balanceOf(appt);
  const cancelled = appt.status === 'cancelada';

  return (
    <button className={`appt kind-${appt.kind} ${cancelled ? 'is-cancelled' : ''} ${inProgress ? 'is-now' : ''}`} onClick={() => onOpen(appt)}>
      <div className="appt-time">
        {showDate && <span className="appt-date">{start.toLocaleDateString('es', { day: 'numeric', month: 'short' })}</span>}
        <strong>{fmtTime(start)}</strong>
        {end && <span>{fmtTime(end)}</span>}
      </div>
      <div className="appt-main">
        <div className="appt-top">
          <span className="appt-kind">{KINDS[appt.kind]?.emoji} {appt.session_type || KINDS[appt.kind]?.short}</span>
          {inProgress && !cancelled && <span className="pill pill-now">Ahora</span>}
          <span className={`pill status-${appt.status}`}>{STATUSES[appt.status]}</span>
        </div>
        <p className="appt-title">{appt.title}</p>
        <div className="appt-meta">
          {client && <span><Icon name="user" size={14} /> {client.name}</span>}
          {(appt.location || appt.address) && <span><Icon name="pin" size={14} /> {appt.location || appt.address}</span>}
          {balance > 0 && !cancelled && <span className="owed"><Icon name="money" size={14} /> Debe {money(balance, currency)}</span>}
        </div>
      </div>
    </button>
  );
}
