import { useMemo, useState } from 'react';
import { KINDS, STATUSES, SESSION_TYPES, REMINDER_OPTIONS, dayKey, timeKey, fromKeys, reminderLabel } from '../lib/format.js';
import { Field, Sheet, useToast } from './ui.jsx';

function nextRoundHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function AppointmentForm({ initial, defaultDate, defaultClientId, clients, settings, saveAppointment, saveClient, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(initial?.id);

  const startBase = initial?.start_at
    ? new Date(initial.start_at)
    : (() => {
        const t = nextRoundHour();
        if (!defaultDate) return t;
        const d = new Date(defaultDate);
        d.setHours(dayKey(d) === dayKey(new Date()) ? t.getHours() : 9, 0, 0, 0);
        return d;
      })();
  const endBase = initial?.id ? (initial.end_at ? new Date(initial.end_at) : null) : new Date(startBase.getTime() + 3600e3);

  const initialClient = clients.find((c) => c.id === (initial?.client_id ?? defaultClientId));

  const [f, setF] = useState({
    kind: initial?.kind ?? 'sesion',
    session_type: initial?.session_type ?? '',
    title: initial?.title ?? '',
    date: dayKey(startBase),
    start: timeKey(startBase),
    end: endBase ? timeKey(endBase) : '',
    location: initial?.location ?? '',
    address: initial?.address ?? '',
    price: initial?.price ?? '',
    paid: initial?.paid ? initial.paid : '',
    status: initial?.status ?? 'pendiente',
    notes: initial?.notes ?? '',
    reminders: initial?.reminders ?? settings?.default_reminders ?? [1440, 120, 30]
  });
  const [clientId, setClientId] = useState(initialClient?.id ?? null);
  const [clientName, setClientName] = useState(initialClient?.name ?? '');
  const [clientPhone, setClientPhone] = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [customUnit, setCustomUnit] = useState('min');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const suggestions = useMemo(() => {
    const q = clientName.trim().toLowerCase();
    if (!q) return clients.slice(0, 6);
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)).slice(0, 6);
  }, [clientName, clients]);

  const toggleReminder = (m) =>
    setF((s) => ({
      ...s,
      reminders: s.reminders.includes(m) ? s.reminders.filter((x) => x !== m) : [...s.reminders, m].sort((a, b) => b - a)
    }));

  const addCustom = () => {
    const n = Number(customMin);
    if (!Number.isFinite(n) || n < 0) return;
    const minutes = Math.round(n * (customUnit === 'h' ? 60 : customUnit === 'd' ? 1440 : 1));
    if (!f.reminders.includes(minutes)) setF((s) => ({ ...s, reminders: [...s.reminders, minutes].sort((a, b) => b - a) }));
    setCustomMin('');
  };

  const save = async (e) => {
    e.preventDefault();
    const start = fromKeys(f.date, f.start);
    let end = f.end ? fromKeys(f.date, f.end) : null;
    if (end && end <= start) end = new Date(end.getTime() + 86400e3); // termina al día siguiente
    setBusy(true);
    try {
      let cid = clientId;
      const name = clientName.trim();
      if (!cid && name) {
        const c = await saveClient({ name, phone: clientPhone.trim() || null });
        cid = c.id;
      }
      if (!name) cid = null;
      const title =
        f.title.trim() ||
        [KINDS[f.kind].short, f.session_type, name && `· ${name}`].filter(Boolean).join(' ');
      const row = await saveAppointment({
        ...(editing ? { id: initial.id } : {}),
        client_id: cid,
        kind: f.kind,
        session_type: f.session_type.trim() || null,
        title,
        start_at: start.toISOString(),
        end_at: end ? end.toISOString() : null,
        location: f.location.trim() || null,
        address: f.address.trim() || null,
        price: f.price === '' ? null : Number(f.price),
        paid: f.paid === '' ? 0 : Number(f.paid),
        status: f.status,
        notes: f.notes.trim() || null,
        reminders: f.reminders
      });
      toast(editing ? 'Cita actualizada' : 'Cita agendada ✓');
      onSaved?.(row);
      onClose();
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={editing ? 'Editar cita' : 'Nueva cita'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="appt-form" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="appt-form" className="stack" onSubmit={save}>
        <div className="kind-picker" role="radiogroup" aria-label="Tipo">
          {Object.entries(KINDS).map(([k, v]) => (
            <button type="button" key={k} role="radio" aria-checked={f.kind === k}
              className={`kind-opt kind-${k} ${f.kind === k ? 'on' : ''}`} onClick={() => setF((s) => ({ ...s, kind: k }))}>
              <span className="kind-emoji">{v.emoji}</span>{v.short}
            </button>
          ))}
        </div>

        <div className="grid-2">
          <Field label="Fecha"><input type="date" required value={f.date} onChange={set('date')} /></Field>
          <div className="grid-2 tight">
            <Field label="Desde"><input type="time" required value={f.start} onChange={set('start')} /></Field>
            <Field label="Hasta"><input type="time" value={f.end} onChange={set('end')} /></Field>
          </div>
        </div>

        <div className="field combo">
          <span className="field-label">Cliente</span>
          <input
            value={clientName}
            placeholder="Buscar o escribir un nombre nuevo"
            onChange={(e) => { setClientName(e.target.value); setClientId(null); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          />
          {showSuggest && suggestions.length > 0 && (
            <ul className="combo-list">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setClientId(c.id); setClientName(c.name); setShowSuggest(false); }}>
                    <strong>{c.name}</strong>{c.phone && <span className="muted"> · {c.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {clientName.trim() && !clientId && (
            <div className="new-client">
              <span className="pill">Cliente nuevo</span>
              <input type="tel" inputMode="tel" placeholder="Teléfono / WhatsApp (opcional)" value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)} />
            </div>
          )}
        </div>

        {(f.kind === 'sesion' || f.kind === 'entrega' || f.kind === 'visita') && (
          <Field label="Tipo de sesión">
            <input list="session-types" value={f.session_type} onChange={set('session_type')} placeholder="Boda, XV años, estudio…" />
            <datalist id="session-types">{SESSION_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
        )}

        <Field label="Título" hint="Si lo dejas vacío se arma solo con el tipo y el cliente">
          <input value={f.title} onChange={set('title')} placeholder="Ej: Sesión de boda Ana y Juan" />
        </Field>

        <div className="grid-2">
          <Field label="Lugar"><input value={f.location} onChange={set('location')} placeholder="Estudio, parque, salón…" /></Field>
          <Field label="Dirección"><input value={f.address} onChange={set('address')} placeholder="Para abrir en Maps o Waze" /></Field>
        </div>

        <div className="grid-3">
          <Field label="Precio"><input type="number" inputMode="decimal" min="0" step="any" value={f.price} onChange={set('price')} placeholder="0" /></Field>
          <Field label="Abonado"><input type="number" inputMode="decimal" min="0" step="any" value={f.paid} onChange={set('paid')} placeholder="0" /></Field>
          <Field label="Estado">
            <select value={f.status} onChange={set('status')}>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <div className="field">
          <span className="field-label">Recordatorios</span>
          <div className="chips">
            {[...new Set([...REMINDER_OPTIONS.map((o) => o.m), ...f.reminders])].sort((a, b) => b - a).map((m) => (
              <button type="button" key={m} className={`chip ${f.reminders.includes(m) ? 'on' : ''}`} onClick={() => toggleReminder(m)}>
                {reminderLabel(m)}{m > 0 ? ' antes' : ''}
              </button>
            ))}
          </div>
          <div className="custom-reminder">
            <input type="number" min="0" inputMode="numeric" placeholder="Otro" value={customMin} onChange={(e) => setCustomMin(e.target.value)} />
            <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} aria-label="Unidad">
              <option value="min">minutos</option>
              <option value="h">horas</option>
              <option value="d">días</option>
            </select>
            <button type="button" className="btn btn-soft" onClick={addCustom}>Añadir</button>
          </div>
        </div>

        <Field label="Notas">
          <textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Vestuario, ideas, qué llevar, equipo…" />
        </Field>
      </form>
    </Sheet>
  );
}
