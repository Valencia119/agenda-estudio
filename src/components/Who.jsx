// Etiqueta y filtro de fotógrafa (solo se muestran si el estudio tiene más de una)

export function whoOf(appt, memberById) {
  if (!appt.assigned_to) return { name: 'Ambas', color: 'var(--muted)' };
  const m = memberById[appt.assigned_to];
  return m ? { name: m.display_name, color: m.color } : { name: 'Sin asignar', color: 'var(--muted)' };
}

export function WhoTag({ appt, memberById }) {
  const w = whoOf(appt, memberById);
  return (
    <span className="who" style={{ '--who': w.color }}>
      <i className="who-dot" aria-hidden="true" />{w.name}
    </span>
  );
}

export function WhoFilter({ members, value, onChange, me }) {
  if (members.length < 2) return null;
  return (
    <div className="chips who-filter" role="radiogroup" aria-label="Filtrar por fotógrafa">
      <button className={`chip ${value === 'all' ? 'on' : ''}`} role="radio" aria-checked={value === 'all'} onClick={() => onChange('all')}>
        Todas
      </button>
      {members.map((m) => (
        <button key={m.user_id} role="radio" aria-checked={value === m.user_id}
          className={`chip ${value === m.user_id ? 'on' : ''}`} style={{ '--who': m.color }} onClick={() => onChange(m.user_id)}>
          <i className="who-dot" aria-hidden="true" />{m.display_name}{m.user_id === me ? ' (tú)' : ''}
        </button>
      ))}
    </div>
  );
}
