import { useEffect, useState } from 'react';
import { Field, Icon, Toggle, useToast } from '../components/ui.jsx';
import { CURRENCIES, REMINDER_OPTIONS } from '../lib/format.js';
import { isDesktopApp, isIOS, isStandalone } from '../lib/device.js';
import { useStudio } from '../lib/studio.js';

const REPO = import.meta.env.VITE_GITHUB_REPO || 'Valencia119/agenda-estudio';
export const EXE_URL = `https://github.com/${REPO}/releases/latest/download/AgendaEstudio-Setup.exe`;

export function PushControls({ pushState, onEnable, onTest }) {
  if (pushState === 'desktop') {
    return <p className="note note-ok">Estás en el programa de Windows: los avisos salen en la esquina de la pantalla mientras el programa está en la bandeja (junto al reloj).</p>;
  }
  if (pushState === 'ios-needs-install') {
    return (
      <div className="note">
        <strong>En iPhone primero instala la app:</strong>
        <ol className="steps">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca <b>Compartir</b> <Icon name="share" size={14} /> y luego <b>“Agregar a pantalla de inicio”</b>.</li>
          <li>Abre la app desde el ícono nuevo y vuelve aquí para activar los recordatorios.</li>
        </ol>
      </div>
    );
  }
  if (pushState === 'unsupported') return <p className="note note-err">Este navegador no permite notificaciones. Usa Safari (iPhone), Edge o Chrome.</p>;
  if (pushState === 'denied') {
    return <p className="note note-err">Las notificaciones están bloqueadas. Actívalas en Ajustes del dispositivo → Notificaciones → Agenda, y vuelve a abrir la app.</p>;
  }
  return (
    <div className="stack-sm">
      <p className={`note ${pushState === 'on' ? 'note-ok' : ''}`}>
        {pushState === 'on' ? '✅ Recordatorios activados en este dispositivo.' : 'Los recordatorios aún no están activados en este dispositivo.'}
      </p>
      <div className="action-row">
        {pushState !== 'on' && <button className="btn btn-primary" onClick={onEnable}><Icon name="bell" size={18} /> Activar recordatorios</button>}
        {pushState === 'on' && <button className="btn btn-soft" onClick={onTest}>Enviar notificación de prueba</button>}
      </div>
    </div>
  );
}

function StudioCard({ user, actions }) {
  const toast = useToast();
  const { studio, members } = useStudio();
  const me = members.find((m) => m.user_id === user.id);
  const isOwner = me?.role === 'owner';
  const [studioName, setStudioName] = useState(studio?.name || '');
  const [myName, setMyName] = useState(me?.display_name || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setStudioName(studio?.name || ''), [studio?.name]);
  useEffect(() => setMyName(me?.display_name || ''), [me?.display_name]);
  if (!studio) return null;

  const link = `${location.origin}${import.meta.env.BASE_URL}?invitar=${studio.invite_code}`;
  const message =
    `Hola 👋 ${me?.display_name || ''} te invitó a la agenda de "${studio.name}".\n\n` +
    `1. Abre este link y crea tu cuenta: ${link}\n` +
    `2. En iPhone, después toca Compartir → "Agregar a pantalla de inicio" y entra con la misma cuenta.\n\n` +
    `Código de invitación: ${studio.invite_code}`;

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  const copy = () => run(async () => navigator.clipboard.writeText(message), 'Invitación copiada');
  const share = () => run(async () => navigator.share({ title: 'Agenda Estudio', text: message }).catch(() => {}));
  const regenerate = () => {
    if (!window.confirm('¿Crear un link nuevo? El link anterior dejará de funcionar (quienes ya están en el estudio siguen igual).')) return;
    run(() => actions.newInviteCode(), 'Link nuevo creado');
  };
  const join = (e) => {
    e.preventDefault();
    if (!window.confirm('¿Unirte a ese estudio? Tus citas y clientes se pasarán al estudio nuevo.')) return;
    run(async () => {
      const r = await actions.joinStudio(code);
      setCode('');
      toast(r.already ? 'Ya estás en ese estudio' : `Te uniste a ${r.name} 🎉`);
    });
  };

  return (
    <section className="card">
      <h2 className="card-title"><Icon name="users" /> Estudio</h2>
      <div className="grid-2">
        <Field label="Nombre del estudio" hint={isOwner ? null : 'Solo la dueña puede cambiarlo'}>
          <input value={studioName} disabled={!isOwner} onChange={(e) => setStudioName(e.target.value)}
            onBlur={() => studioName.trim() && studioName !== studio.name && run(() => actions.saveStudioName(studioName.trim()), 'Guardado')} />
        </Field>
        <Field label="Tu nombre">
          <input value={myName} onChange={(e) => setMyName(e.target.value)}
            onBlur={() => myName.trim() && myName !== me?.display_name && run(() => actions.saveMyName(myName.trim()), 'Guardado')} />
        </Field>
      </div>

      <ul className="team">
        {members.map((m) => (
          <li key={m.user_id} style={{ '--who': m.color }}>
            <span className="avatar" style={{ background: 'color-mix(in srgb, var(--who) 18%, var(--surface))', color: 'var(--who)' }}>
              {m.display_name.charAt(0).toUpperCase()}
            </span>
            <strong>{m.display_name}</strong>
            <span className="muted small">{[m.role === 'owner' && 'dueña', m.user_id === user.id && 'tú'].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>

      <div className="invite">
        <p><strong>Invitar a otra fotógrafa</strong></p>
        <p className="muted small">Verá y podrá editar toda la agenda, los clientes y los pagos del estudio, y recibirá todos los recordatorios.</p>
        <div className="action-row">
          <a className="btn btn-wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
            <Icon name="chat" size={18} /> Enviar por WhatsApp
          </a>
          {navigator.share ? (
            <button className="btn btn-soft" disabled={busy} onClick={share}><Icon name="share" size={18} /> Compartir</button>
          ) : (
            <button className="btn btn-soft" disabled={busy} onClick={copy}>Copiar invitación</button>
          )}
        </div>
        <p className="muted small">Código: <strong className="code">{studio.invite_code}</strong>
          {isOwner && <> · <button className="link small" disabled={busy} onClick={regenerate}>Cambiar link</button></>}
        </p>
      </div>

      <details className="join">
        <summary>¿Te invitaron a otro estudio?</summary>
        <form className="custom-reminder" onSubmit={join}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código de invitación" required />
          <span />
          <button className="btn btn-soft" disabled={busy}>Unirme</button>
        </form>
      </details>
    </section>
  );
}

export default function Settings({ settings, user, pushState, onEnablePush, onTestPush, saveSettings, onSignOut, data, studioActions }) {
  const toast = useToast();
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  if (!s) return null;

  const save = async (patch) => {
    setS((x) => ({ ...x, ...patch }));
    try {
      await saveSettings(patch);
      toast('Guardado');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const toggleDefault = (m) => {
    const cur = s.default_reminders || [];
    save({ default_reminders: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m].sort((a, b) => b - a) });
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agenda-copia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="view">
      <header className="view-head"><h1>Ajustes</h1></header>

      <section className="card">
        <h2 className="card-title"><Icon name="bell" /> Notificaciones en este dispositivo</h2>
        <PushControls pushState={pushState} onEnable={onEnablePush} onTest={onTestPush} />
        <p className="muted small">Actívalas en cada dispositivo donde quieras recibir avisos (iPhone y PC).</p>
      </section>

      <StudioCard user={user} actions={studioActions} />

      <section className="card">
        <h2 className="card-title">Resumen diario</h2>
        <div className="setting-line">
          <Toggle label="☀️ En la mañana: lo de hoy"checked={s.morning_enabled} onChange={(v) => save({ morning_enabled: v })} />
          <input type="time" value={s.morning_time?.slice(0, 5)} disabled={!s.morning_enabled}
            onChange={(e) => e.target.value && save({ morning_time: e.target.value })} aria-label="Hora del resumen de la mañana" />
        </div>
        <div className="setting-line">
          <Toggle label="🌙 En la noche: lo de mañana"checked={s.evening_enabled} onChange={(v) => save({ evening_enabled: v })} />
          <input type="time" value={s.evening_time?.slice(0, 5)} disabled={!s.evening_enabled}
            onChange={(e) => e.target.value && save({ evening_time: e.target.value })} aria-label="Hora del aviso de la noche" />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Recordatorios por defecto para citas nuevas</h2>
        <div className="chips">
          {REMINDER_OPTIONS.map((o) => (
            <button key={o.m} className={`chip ${(s.default_reminders || []).includes(o.m) ? 'on' : ''}`} onClick={() => toggleDefault(o.m)}>
              {o.label}{o.m > 0 ? ' antes' : ''}
            </button>
          ))}
        </div>
        <p className="muted small">En cada cita puedes cambiarlos o añadir otros.</p>
      </section>

      <section className="card">
        <h2 className="card-title">Preferencias</h2>
        <div className="grid-2">
          <Field label="Moneda">
            <select value={s.currency} onChange={(e) => save({ currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Código de país para WhatsApp" hint="Colombia 57 · México 52 · EE. UU. 1">
            <input inputMode="numeric" value={s.country_code} onChange={(e) => setS((x) => ({ ...x, country_code: e.target.value.replace(/\D/g, '') }))}
              onBlur={(e) => e.target.value && save({ country_code: e.target.value })} />
          </Field>
        </div>
        <p className="muted small">Zona horaria: {s.timezone}</p>
      </section>

      {!isDesktopApp && (
        <section className="card">
          <h2 className="card-title"><Icon name="download" /> Instalar en otros dispositivos</h2>
          {isIOS && !isStandalone && <p className="note">En iPhone: Safari → Compartir → “Agregar a pantalla de inicio”.</p>}
          <div className="action-row">
            <a className="btn btn-soft" href={EXE_URL}>Descargar para Windows (.exe)</a>
            <a className="btn btn-ghost" href="instalar.html">Ver instrucciones</a>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Cuenta</h2>
        <p className="muted">{user.email}</p>
        <div className="action-row">
          <button className="btn btn-soft" onClick={backup}><Icon name="download" size={18} /> Descargar copia de seguridad</button>
          <button className="btn btn-danger-ghost" onClick={onSignOut}>Cerrar sesión</button>
        </div>
      </section>
      <p className="muted small center">Agenda Estudio · v1.0</p>
    </div>
  );
}
