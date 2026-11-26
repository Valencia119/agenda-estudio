import { useState } from 'react';
import { Field, Sheet, useToast } from './ui.jsx';

export default function ClientForm({ initial, saveClient, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    instagram: initial?.instagram ?? '',
    notes: initial?.notes ?? ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
      const row = await saveClient({ ...(initial?.id ? { id: initial.id } : {}), ...clean });
      toast(initial?.id ? 'Cliente actualizado' : 'Cliente guardado ✓');
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
      title={initial?.id ? 'Editar cliente' : 'Nuevo cliente'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" form="client-form" className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      <form id="client-form" className="stack" onSubmit={save}>
        <Field label="Nombre"><input required value={f.name} onChange={set('name')} placeholder="Nombre y apellido" autoFocus /></Field>
        <div className="grid-2">
          <Field label="Teléfono / WhatsApp"><input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="300 123 4567" /></Field>
          <Field label="Instagram"><input value={f.instagram} onChange={set('instagram')} placeholder="@usuario" /></Field>
        </div>
        <Field label="Correo"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Notas"><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Gustos, cómo llegó, fechas especiales…" /></Field>
      </form>
    </Sheet>
  );
}
