import { useState } from 'react';
import {
  KINDS, STATUSES, balanceOf, fmtDayLong, fmtTime, money, reminderLabel,
  waLink, telLink, mapsLink, wazeLink, appleMapsLink
} from '../lib/format.js';
import { isIOS } from '../lib/device.js';
import { Icon, Sheet, useToast } from './ui.jsx';

const WA_PHRASE = {
  sesion: 'tu sesión de fotos',
  visita: 'tu cita en el estudio',
  salida: 'tu sesión de fotos',
  entrega: 'la entrega de tus fotos',
  otro: 'nuestra cita'
};

export default function AppointmentDetail({ appt, client, settings, saveAppointment, deleteAppointment, onEdit, onOpenClient, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const currency = settings?.currency || 'COP';
  const start = new Date(appt.start_at);
  const end = appt.end_at ? new Date(appt.end_at) : null;
  const balance = balanceOf(appt);
  const place = appt.address || appt.location;

  const patch = async (fields, msg) => {
    setBusy(true);
    try {
      await saveAppointment({ ...appt, ...fields });
      toast(msg);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('¿Eliminar esta cita? No se puede deshacer.')) return;
    try {
      await deleteAppointment(appt.id);
      toast('Cita eliminada');
      onClose();
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const waText = client
    ? `Hola ${client.name.split(' ')[0]}, te escribo para recordarte ${WA_PHRASE[appt.kind] || 'nuestra cita'} el ${fmtDayLong(start).toLowerCase()} a las ${fmtTime(start)}${appt.location ? ` en ${appt.location}` : ''}. 📸`
    : '';
  const wa = client && waLink(client.phone, settings?.country_code || '57', waText);

  return (
    <Sheet
      title={`${KINDS[appt.kind]?.emoji} ${KINDS[appt.kind]?.short}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-ghost" onClick={remove}><Icon name="trash" size={18} /> Eliminar</button>
          <button className="btn btn-primary" onClick={onEdit}><Icon name="edit" size={18} /> Editar</button>
        </>
      }
    >
      <div className={`detail-hero kind-${appt.kind}`}>
        <h3>{appt.title}</h3>
        <p><Icon name="calendar" size={16} /> {fmtDayLong(start)}</p>
        <p><Icon name="clock" size={16} /> {fmtTime(start)}{end ? ` – ${fmtTime(end)}` : ''}</p>
        {appt.session_type && <p><Icon name="camera" size={16} /> {appt.session_type}</p>}
      </div>

      <section className="detail-section">
        <h4>Estado</h4>
        <div className="chips">
          {Object.entries(STATUSES).map(([k, v]) => (
            <button key={k} disabled={busy} className={`chip status-chip status-${k} ${appt.status === k ? 'on' : ''}`}
              onClick={() => appt.status !== k && patch({ status: k }, `Marcada como: ${v}`)}>
              {v}
            </button>
          ))}
        </div>
      </section>

      {client && (
        <section className="detail-section">
          <h4>Cliente</h4>
          <button className="row-link" onClick={() => onOpenClient(client)}>
            <Icon name="user" /> <span><strong>{client.name}</strong>{client.phone && <span className="muted"> · {client.phone}</span>}</span>
            <Icon name="right" size={16} />
          </button>
          <div className="action-row">
            {wa && <a className="btn btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> WhatsApp</a>}
            {client.phone && <a className="btn btn-soft" href={telLink(client.phone)}><Icon name="phone" size={18} /> Llamar</a>}
          </div>
        </section>
      )}

      {(appt.location || appt.address) && (
        <section className="detail-section">
          <h4>Lugar</h4>
          <p className="detail-text"><Icon name="pin" size={16} /> {[appt.location, appt.address].filter(Boolean).join(' · ')}</p>
          <div className="action-row">
            <a className="btn btn-soft" href={mapsLink(place)} target="_blank" rel="noreferrer"><Icon name="pin" size={18} /> Google Maps</a>
            <a className="btn btn-soft" href={wazeLink(place)} target="_blank" rel="noreferrer"><Icon name="nav" size={18} /> Waze</a>
            {isIOS && <a className="btn btn-soft" href={appleMapsLink(place)} target="_blank" rel="noreferrer">Mapas</a>}
          </div>
        </section>
      )}

      {(appt.price != null || Number(appt.paid) > 0) && (
        <section className="detail-section">
          <h4>Pago</h4>
          <div className="money-grid">
            <div><span className="muted">Precio</span><strong>{money(appt.price, currency)}</strong></div>
            <div><span className="muted">Abonado</span><strong>{money(appt.paid, currency)}</strong></div>
            <div className={balance > 0 ? 'owed' : 'paid'}><span className="muted">Saldo</span><strong>{balance > 0 ? money(balance, currency) : 'Pagado ✓'}</strong></div>
          </div>
          {balance > 0 && (
            <button className="btn btn-soft btn-block" disabled={busy} onClick={() => patch({ paid: Number(appt.price) }, 'Pago completo registrado')}>
              <Icon name="check" size={18} /> Marcar como pagado completo
            </button>
          )}
        </section>
      )}

      <section className="detail-section">
        <h4>Recordatorios</h4>
        {appt.reminders?.length ? (
          <div className="chips">{[...appt.reminders].sort((a, b) => b - a).map((m) => (
            <span key={m} className="chip on static"><Icon name="bell" size={14} /> {reminderLabel(m)}{m > 0 ? ' antes' : ''}</span>
          ))}</div>
        ) : <p className="muted">Sin recordatorios</p>}
      </section>

      {appt.notes && (
        <section className="detail-section">
          <h4>Notas</h4>
          <p className="detail-text pre">{appt.notes}</p>
        </section>
      )}
    </Sheet>
  );
}
