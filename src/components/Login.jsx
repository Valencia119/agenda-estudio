import { useState } from 'react';
import { supabase } from '../supabase.js';
import { Field, Icon } from './ui.jsx';
import { INVITE_KEY } from '../lib/useAgenda.js';

const hasInvite = () => {
  try { return Boolean(localStorage.getItem(INVITE_KEY)); } catch { return false; }
};

export default function Login({ recovery = false, onRecovered }) {
  const invited = hasInvite();
  const [mode, setMode] = useState(recovery ? 'reset' : invited ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message.includes('Invalid') ? 'Correo o contraseña incorrectos.' : error.message);
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { name: name.trim() } }
        });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Revisa tu correo para confirmar la cuenta y luego entra aquí.' });
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname
        });
        if (error) throw error;
        setMsg({ ok: true, text: 'Te enviamos un correo con el enlace para cambiar la contraseña.' });
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        onRecovered?.();
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message || 'Algo salió mal' });
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    login: 'Entrar a tu agenda',
    signup: 'Crear tu cuenta',
    forgot: 'Recuperar contraseña',
    reset: 'Nueva contraseña'
  };

  return (
    <div className="login">
      <div className="login-card">
        <img src="icons/icon-192.png" alt="" className="login-logo" width="72" height="72" />
        <h1 className="brand">Agenda Estudio</h1>
        <p className="muted center">Tus sesiones, clientes y recordatorios en un solo lugar.</p>

        <form onSubmit={submit} className="stack">
          <h2 className="login-title">{titles[mode]}</h2>
          {invited && mode !== 'reset' && (
            <p className="note note-ok">💌 Te invitaron a la agenda de un estudio. {mode === 'signup' ? 'Crea tu cuenta' : 'Entra'} y quedarás dentro automáticamente.</p>
          )}
          {mode === 'signup' && (
            <Field label="Tu nombre" hint="Así te verán tus compañeras en la agenda">
              <input required autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alejandra" />
            </Field>
          )}
          {mode !== 'reset' && (
            <Field label="Correo">
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          )}
          {mode !== 'forgot' && (
            <Field label="Contraseña" hint={mode !== 'login' ? 'Mínimo 6 caracteres' : null}>
              <input type="password" required minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
          )}
          {msg && <p className={msg.ok ? 'note note-ok' : 'note note-err'}>{msg.text}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Crear cuenta' : mode === 'forgot' ? 'Enviar enlace' : 'Guardar contraseña'}
          </button>
        </form>

        {mode !== 'reset' && (
          <div className="login-links">
            {mode === 'login' ? (
              <>
                <button className="link" onClick={() => setMode('signup')}>Crear cuenta nueva</button>
                <button className="link" onClick={() => setMode('forgot')}>Olvidé mi contraseña</button>
              </>
            ) : (
              <button className="link" onClick={() => setMode('login')}>Ya tengo cuenta · Entrar</button>
            )}
          </div>
        )}
        <a className="install-link" href="instalar.html"><Icon name="download" size={16} /> Cómo instalar en iPhone o Windows</a>
      </div>
    </div>
  );
}
