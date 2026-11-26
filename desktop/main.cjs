// Agenda Estudio · programa de Windows
// Abre la agenda web, vive en la bandeja del sistema y muestra los recordatorios.
const { app, BrowserWindow, Tray, Menu, Notification, shell, ipcMain, nativeImage } = require('electron');
const path = require('path');

const APP_URL = 'https://valencia119.github.io/agenda-estudio/';
const APP_ORIGIN = new URL(APP_URL).origin;
const ICON = path.join(__dirname, 'build', 'icon.png');
const TRAY_ICON = path.join(__dirname, 'build', 'tray.png');
const startHidden = process.argv.includes('--hidden');

let win = null;
let tray = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

app.setAppUserModelId('com.agendaestudio.app'); // necesario para notificaciones en Windows

function showWindow() {
  if (!win) return createWindow(false);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function isAppUrl(url) {
  try {
    const u = new URL(url);
    return u.origin === APP_ORIGIN && u.pathname.startsWith(new URL(APP_URL).pathname);
  } catch {
    return false;
  }
}

function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 380,
    minHeight: 560,
    show: !hidden,
    icon: ICON,
    title: 'Agenda Estudio',
    autoHideMenuBar: true,
    backgroundColor: '#f6f1ea',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false // los recordatorios siguen corriendo con la ventana oculta
    }
  });

  win.loadURL(APP_URL);

  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));
  });

  // WhatsApp, mapas, etc. se abren en el navegador normal
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url) && !url.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // cerrar = esconder en la bandeja (sigue avisando)
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
      if (!app.__trayHintShown && Notification.isSupported()) {
        app.__trayHintShown = true;
        new Notification({
          title: 'Agenda Estudio sigue activa',
          body: 'Quedó junto al reloj para seguir enviándote los recordatorios.',
          icon: ICON
        }).show();
      }
    }
  });
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  tray.setToolTip('Agenda Estudio');
  const refreshMenu = () => {
    const login = app.getLoginItemSettings();
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Abrir agenda', click: showWindow },
        { type: 'separator' },
        {
          label: 'Iniciar con Windows',
          type: 'checkbox',
          checked: login.openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] });
            refreshMenu();
          }
        },
        { type: 'separator' },
        { label: 'Salir', click: () => { quitting = true; app.quit(); } }
      ])
    );
  };
  refreshMenu();
  tray.on('click', showWindow);
}

ipcMain.on('agenda:notify', (_e, payload) => {
  if (!Notification.isSupported() || !payload) return;
  const n = new Notification({
    title: String(payload.title || 'Agenda Estudio').slice(0, 200),
    body: String(payload.body || '').slice(0, 500),
    icon: ICON
  });
  n.on('click', showWindow);
  n.show();
});

ipcMain.on('agenda:retry', () => win && win.loadURL(APP_URL));

app.whenReady().then(() => {
  // la primera vez queda configurada para arrancar con Windows
  if (app.isPackaged && !require('fs').existsSync(path.join(app.getPath('userData'), '.configured'))) {
    app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
    require('fs').writeFileSync(path.join(app.getPath('userData'), '.configured'), '1');
  }
  buildTray();
  createWindow(startHidden);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', (e) => e.preventDefault());
