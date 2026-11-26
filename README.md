# 📸 Agenda Estudio

Agenda virtual y mini-CRM para un estudio de fotografía. Funciona en **iPhone** y en **Windows**, con los datos sincronizados entre los dos y **recordatorios automáticos**.

## ⬇️ Instalar

### 👉 [Abrir la página de instalación](https://valencia119.github.io/agenda-estudio/instalar.html)

| Dispositivo | Cómo |
|---|---|
| **iPhone / iPad** | Abre [la agenda](https://valencia119.github.io/agenda-estudio/) en **Safari** → **Compartir** → **Agregar a pantalla de inicio**. Abre el ícono nuevo y toca **Activar recordatorios**. (iOS 16.4 o más nuevo) |
| **Windows** | [**Descargar AgendaEstudio-Setup.exe**](https://github.com/Valencia119/agenda-estudio/releases/latest/download/AgendaEstudio-Setup.exe) y ábrelo. Si aparece *“Windows protegió tu PC”* → **Más información** → **Ejecutar de todas formas**. |
| **Windows (sin descargar)** | Abre [la agenda](https://valencia119.github.io/agenda-estudio/) en Edge o Chrome → ícono **Instalar** en la barra de direcciones. |

## ✨ Qué hace

- **Hoy**: lo que tienes hoy, mañana y los próximos días, con lo que está en curso resaltado.
- **Calendario** mensual con puntos de color por tipo de cita.
- **Tipos**: 📸 Sesión · 🤝 Visita al estudio · 🚗 Salida/locación · 🎁 Entrega de fotos · 📌 Otro.
- **Clientes**: teléfono, WhatsApp (con mensaje de recordatorio ya escrito), Instagram, correo, notas e historial de sesiones.
- **Lugar**: botones para abrir la dirección en Google Maps, Waze o Mapas de Apple.
- **Pagos**: precio, abono y saldo pendiente; total por cobrar y filtro de clientes con deuda.
- **Estados**: pendiente, confirmada, realizada, fotos entregadas, cancelada.
- **Recordatorios** (llegan aunque la app esté cerrada):
  - ☀️ Resumen cada mañana con lo del día.
  - 🌙 Aviso cada noche con lo de mañana.
  - Por cada cita: 1 semana, 2 días, 1 día, 3 h, 2 h, 1 h, 30 min, 15 min, a la hora, o el tiempo que ella quiera.
- Sincronización en tiempo real entre iPhone y PC, modo oscuro y copia de seguridad descargable.

## 🛠️ Cómo está hecha

| Parte | Tecnología |
|---|---|
| App (PWA) | Vite + React, publicada en GitHub Pages (rama `gh-pages`) |
| Datos y sesión | Supabase (Postgres con Row Level Security: cada cuenta solo ve lo suyo) |
| Recordatorios | `pg_cron` cada minuto → Edge Function `send-reminders` → Web Push (VAPID) |
| Windows | Electron (`desktop/`): abre la app, vive en la bandeja, arranca con Windows y muestra avisos nativos |

```
src/                     app React (vistas, componentes, service worker)
public/instalar.html     página de instalación
supabase/migrations/     tablas, seguridad, trigger de recordatorios, cron
supabase/functions/      función que envía las notificaciones
desktop/                 programa de Windows (Electron)
```

### Desarrollo

```bash
cp .env.example .env      # llena con los datos de tu proyecto de Supabase
npm install
npm run dev
```

### Publicar una nueva versión

```bash
npm run build && npx gh-pages -d dist                  # app web
cd desktop && npm run dist                              # instalador de Windows
gh release create vX.Y.Z desktop/dist/AgendaEstudio-Setup.exe
```

### Backend (Supabase)

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=https://valencia119.github.io/agenda-estudio/ APP_URL=https://valencia119.github.io/agenda-estudio/
npx supabase functions deploy send-reminders --no-verify-jwt
```

La clave privada VAPID **nunca** se sube al repositorio.
