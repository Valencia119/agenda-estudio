import { balanceOf, money, waLink, telLink, igLink } from '../lib/format.js';
import AppointmentCard from './AppointmentCard.jsx';
import { Icon, Sheet, useToast } from './ui.jsx';

export default function ClientDetail({ client, appointments, settings, deleteClient, onEdit, onNewAppt, onOpenAppt, onClose }) {
  const toast = useToast();
  const currency = settings?.currency || 'COP';
  const list = appointments.filter((a) => a.client_id === client.id).sort((a, b) => b.start_at.localeCompare(a.start_at));
  const active = list.filter((a) => a.status !== 'cancelada');
  const total = active.reduce((s, a) => s + Number(a.price || 0), 0);
  const paid = active.reduce((s, a) => s + Number(a.paid || 0), 0);
  const owed = active.reduce((s, a) => s + balanceOf(a), 0);
  const wa = waLink(client.phone, settings?.country_code || '57');

  const remove = async () => {
    if (!window.confirm(`¿Eliminar a ${client.name}? Sus citas se conservan pero quedan sin cliente.`)) return;
    try {
      await deleteClient(client.id);
      toast('Cliente eliminado');
      onClose();
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  return (
    <Sheet
      title="Cliente"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-ghost" onClick={remove}><Icon name="trash" size={18} /> Eliminar</button>
          <button className="btn btn-soft" onClick={onEdit}><Icon name="edit" size={18} /> Editar</button>
          <button className="btn btn-primary" onClick={onNewAppt}><Icon name="plus" size={18} /> Agendar</button>
        </>
      }
    >
      <div className="client-hero">
        <div className="avatar avatar-lg">{client.name.trim().charAt(0).toUpperCase()}</div>
        <div>
          <h3>{client.name}</h3>
          {client.phone && <p className="muted">{client.phone}</p>}
        </div>
      </div>

      <div className="action-row">
        {wa && <a className="btn btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="chat" size={18} /> WhatsApp</a>}
        {client.phone && <a className="btn btn-soft" href={telLink(client.phone)}><Icon name="phone" size={18} /> Llamar</a>}
        {client.instagram && <a className="btn btn-soft" href={igLink(client.instagram)} target="_blank" rel="noreferrer">Instagram</a>}
        {client.email && <a className="btn btn-soft" href={`mailto:${client.email}`}><Icon name="mail" size={18} /> Correo</a>}
      </div>

      <div className="money-grid">
        <div><span className="muted">Sesiones</span><strong>{active.length}</strong></div>
        <div><span className="muted">Pagado</span><strong>{money(paid, currency)}</strong></div>
        <div className={owed > 0 ? 'owed' : ''}><span className="muted">Debe</span><strong>{money(owed, currency)}</strong></div>
      </div>
      {total > 0 && <p className="muted small">Total facturado: {money(total, currency)}</p>}

      {client.notes && (
        <section className="detail-section">
          <h4>Notas</h4>
          <p className="detail-text pre">{client.notes}</p>
        </section>
      )}

      <section className="detail-section">
        <h4>Historial</h4>
        {list.length ? (
          <div className="list">
            {list.map((a) => <AppointmentCard key={a.id} appt={a} currency={currency} onOpen={onOpenAppt} showDate />)}
          </div>
        ) : <p className="muted">Todavía no tiene citas.</p>}
      </section>
    </Sheet>
  );
}
