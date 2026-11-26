import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Si algo falla, muestra un aviso con botón para recargar en vez de una pantalla en blanco
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="login"><div className="login-card center">
        <h1 className="brand">Algo salió mal</h1>
        <p className="muted">Tus datos están a salvo. Recarga la agenda para continuar.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>Recargar</button>
      </div></div>
    );
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  });
}
