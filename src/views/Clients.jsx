import { useMemo, useState } from 'react';
import { Empty, Icon } from '../components/ui.jsx';
import { balanceOf, money, moneyShort } from '../lib/format.js';

export default function Clients({ clients, appointments, settings, onOpen, onNew }) {
  const [q, setQ] = useState('');
  const [onlyOwed, setOnlyOwed] = useState(false);
  const currency = settings?.currency || 'COP';

  const stats = useMemo(() => {
    const s = {};
    const now = Date.now();
    for (const a of appointments) {
      if (!a.client_id || a.status === 'cancelada') continue;
      const x = (s[a.client_id] ||= { count: 0, owed: 0, next: null });
      x.count++;
      x.owed += balanceOf(a);
      const t = new Date(a.start_at).getTime();
      if (t > now && (!x.next || t < x.next)) x.next = t;
    }
    return s;
  }, [appointments]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (onlyOwed && !(stats[c.id]?.owed > 0)) return false;
      if (!term) return true;
      return [c.name, c.phone, c.email, c.instagram].some((v) => (v || '').toLowerCase().includes(term));
    });
  }, [clients, q, onlyOwed, stats]);

  return (
    <div className="view">
      <header className="view-head row-between">
        <h1>Clientes</h1>
        <button className="btn btn-primary btn-sm" onClick={onNew}><Icon name="plus" size={16} /> Nuevo</button>
      </header>

      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Buscar por nombre, teléfono o Instagram" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips filter-chips">
        <button className={`chip ${!onlyOwed ? 'on' : ''}`} onClick={() => setOnlyOwed(false)}>Todos ({clients.length})</button>
        <button className={`chip ${onlyOwed ? 'on' : ''}`} onClick={() => setOnlyOwed(true)}>Con saldo pendiente</button>
      </div>

      {list.length ? (
        <ul className="client-list">
          {list.map((c) => {
            const s = stats[c.id];
            return (
              <li key={c.id}>
                <button className="client-row" onClick={() => onOpen(c)}>
                  <span className="avatar">{c.name.trim().charAt(0).toUpperCase()}</span>
                  <span className="client-info">
                    <strong>{c.name}</strong>
                    <span className="muted small">
                      {s?.count ? `${s.count} ${s.count === 1 ? 'cita' : 'citas'}` : 'Sin citas'}
                      {s?.next ? ` · próxima ${new Date(s.next).toLocaleDateString('es', { day: 'numeric', month: 'short' })}` : ''}
                    </span>
                  </span>
                  {s?.owed > 0 && <span className="pill owed-pill" title={`Debe ${money(s.owed, currency)}`}>{moneyShort(s.owed, currency)}</span>}
                  <Icon name="right" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon="users" title={clients.length ? 'Sin resultados' : 'Aún no hay clientes'}
          text={clients.length ? 'Prueba con otra búsqueda.' : 'Se agregan solos al agendar una cita, o puedes crearlos aquí.'} />
      )}
    </div>
  );
}
