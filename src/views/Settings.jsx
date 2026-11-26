import { useEffect, useState } from 'react';
import { Field, Icon, Toggle, useToast } from '../components/ui.jsx';
import { CURRENCIES, REMINDER_OPTIONS } from '../lib/format.js';
import { isDesktopApp, isIOS, isStandalone } from '../lib/device.js';

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

export default function Settings({ settings, user, pushState, onEnablePush, onTestPush, saveSettings, onSignOut, data }) {
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

      <section className="card">
        <h2 className="card-title">Resumen diario</h2>
        <div className="setting-line">
          <Toggle label="☀️ Resumen de la mañana (lo que tienes hoy)" checked={s.morning_enabled} onChange={(v) => save({ morning_enabled: v })} />
          <input type="time" value={s.morning_time?.slice(0, 5)} disabled={!s.morning_enabled}
            onChange={(e) => e.target.value && save({ morning_time: e.target.value })} aria-label="Hora del resumen de la mañana" />
        </div>
        <div className="setting-line">
          <Toggle label="🌙 Aviso de la noche (lo que tienes mañana)" checked={s.evening_enabled} onChange={(v) => save({ evening_enabled: v })} />
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
