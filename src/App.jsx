import { useCallback, useEffect, useState } from 'react';
import { supabase, configured } from './supabase.js';
import { useAgenda } from './lib/useAgenda.js';
import { startOfDay } from './lib/format.js';
import { enablePush, getPushState, isDesktopApp, refreshPushSubscription, sendTestPush } from './lib/device.js';
import { checkDesktopReminders } from './lib/desktopReminders.js';
import Login from './components/Login.jsx';
import AppointmentForm from './components/AppointmentForm.jsx';
import AppointmentDetail from './components/AppointmentDetail.jsx';
import ClientForm from './components/ClientForm.jsx';
import ClientDetail from './components/ClientDetail.jsx';
import { Icon, ToastProvider, useToast } from './components/ui.jsx';
import Today from './views/Today.jsx';
import Calendar from './views/Calendar.jsx';
import Clients from './views/Clients.jsx';
import Settings, { PushControls } from './views/Settings.jsx';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="login"><div className="login-card">
        <h1 className="brand">Agenda Estudio</h1>
        <p className="note">Falta configurar la conexión con Supabase (archivo .env).</p>
      </div></div>
    );
  }
  if (session === undefined) return <div className="splash"><img src="icons/icon-192.png" alt="" width="64" height="64" /></div>;

  return (
    <ToastProvider>
      {!session || recovery
        ? <Login recovery={recovery} onRecovered={() => setRecovery(false)} />
        : <Main key={session.user.id} user={session.user} />}
    </ToastProvider>
  );
}

const TABS = [
  { id: 'today', label: 'Hoy', icon: 'today' },
  { id: 'calendar', label: 'Calendario', icon: 'calendar' },
  { id: 'clients', label: 'Clientes', icon: 'users' },
  { id: 'settings', label: 'Ajustes', icon: 'settings' }
];

function Main({ user }) {
  const toast = useToast();
  const agenda = useAgenda(user.id);
  const { appointments, clients, settings } = agenda;
  const [tab, setTab] = useState(() => localStorage.getItem('agenda-tab') || 'today');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [now, setNow] = useState(Date.now());
  const [pushState, setPushState] = useState('off');

  useEffect(() => {
    try { localStorage.setItem('agenda-tab', tab); } catch { /* */ }
  }, [tab]);

  // reloj de la app (resalta la cita en curso)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30e3);
    return () => clearInterval(t);
  }, []);

  // estado de notificaciones
  const refreshPush = useCallback(() => getPushState().then(setPushState).catch(() => setPushState('unsupported')), []);
  useEffect(() => {
    refreshPush();
    refreshPushSubscription(user.id);
  }, [refreshPush, user.id]);

  // programa de Windows: avisos locales
  useEffect(() => {
    if (!isDesktopApp) return;
    checkDesktopReminders({ appointments, clients, settings });
  }, [now, appointments, clients, settings]);

  const onEnablePush = async () => {
    try {
      await enablePush(user.id);
      await refreshPush();
      toast('¡Recordatorios activados! 🔔');
      sendTestPush().catch(() => {});
    } catch (e) {
      toast(e.message || 'No se pudieron activar', 'err');
      refreshPush();
    }
  };
  const onTestPush = async () => {
    try {
      const n = await sendTestPush();
      toast(n ? 'Notificación enviada, debería llegar en segundos' : 'No hay dispositivos activados', n ? 'ok' : 'err');
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const close = useCallback(() => setModal(null), []);
  const openAppt = (a) => setModal({ type: 'appt', id: a.id });
  const newAppt = (date, clientId) => setModal({ type: 'appt-form', date: date ?? (tab === 'calendar' ? selected : null), clientId });
  const openClient = (c) => setModal({ type: 'client', id: c.id });

  const showBanner = !['on', 'desktop', 'unsupported'].includes(pushState);
  const banner = showBanner ? (
    <div className="banner">
      <div className="banner-icon"><Icon name="bell" /></div>
      <div className="banner-body">
        <strong>Activa los recordatorios</strong>
        <PushControls pushState={pushState} onEnable={onEnablePush} onTest={onTestPush} />
      </div>
    </div>
  ) : null;

  const appt = modal?.id && modal.type.startsWith('appt') ? appointments.find((a) => a.id === modal.id) : null;
  const client = modal?.id && modal.type.startsWith('client') ? clients.find((c) => c.id === modal.id) : null;
  const viewProps = { appointments, clients, settings, now };

  return (
    <div className="app">
      <nav className="nav" aria-label="Secciones">
        <div className="nav-brand"><img src="icons/icon-192.png" alt="" width="34" height="34" /><span>Agenda Estudio</span></div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <Icon name={t.icon} size={22} /><span>{t.label}</span>
          </button>
        ))}
        <button className="btn btn-primary nav-new" onClick={() => newAppt()}><Icon name="plus" size={18} /> Nueva cita</button>
      </nav>

      <main className="content">
        {agenda.error && <div className="offline">{agenda.error}</div>}
        {tab === 'today' && <Today {...viewProps} banner={banner} onOpen={openAppt} onNew={newAppt} />}
        {tab === 'calendar' && <Calendar {...viewProps} selected={selected} setSelected={setSelected} onOpen={openAppt} onNew={newAppt} />}
        {tab === 'clients' && <Clients {...viewProps} onOpen={openClient} onNew={() => setModal({ type: 'client-form' })} />}
        {tab === 'settings' && (
          <Settings settings={settings} user={user} pushState={pushState} onEnablePush={onEnablePush} onTestPush={onTestPush}
            saveSettings={agenda.saveSettings} onSignOut={() => supabase.auth.signOut()}
            data={{ clients, appointments }} />
        )}
      </main>

      {tab !== 'settings' && (
        <button className="fab" onClick={() => newAppt()} aria-label="Nueva cita"><Icon name="plus" size={28} /></button>
      )}

      {modal?.type === 'appt-form' && (
        <AppointmentForm
          initial={modal.id ? appt : null}
          defaultDate={modal.date}
          defaultClientId={modal.clientId}
          clients={clients}
          settings={settings}
          saveAppointment={agenda.saveAppointment}
          saveClient={agenda.saveClient}
          onClose={modal.id ? () => setModal({ type: 'appt', id: modal.id }) : close}
        />
      )}
      {modal?.type === 'appt' && appt && (
        <AppointmentDetail
          appt={appt}
          client={clients.find((c) => c.id === appt.client_id)}
          settings={settings}
          saveAppointment={agenda.saveAppointment}
          deleteAppointment={agenda.deleteAppointment}
          onEdit={() => setModal({ type: 'appt-form', id: appt.id })}
          onOpenClient={openClient}
          onClose={close}
        />
      )}
      {modal?.type === 'client' && client && (
        <ClientDetail
          client={client}
          appointments={appointments}
          settings={settings}
          deleteClient={agenda.deleteClient}
          onEdit={() => setModal({ type: 'client-form', id: client.id })}
          onNewAppt={() => newAppt(null, client.id)}
          onOpenAppt={openAppt}
          onClose={close}
        />
      )}
      {modal?.type === 'client-form' && (
        <ClientForm
          initial={modal.id ? client : null}
          saveClient={agenda.saveClient}
          onClose={modal.id ? () => setModal({ type: 'client', id: modal.id }) : close}
        />
      )}
    </div>
  );
}
