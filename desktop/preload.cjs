const { contextBridge, ipcRenderer } = require('electron');

// Lo único que la página puede pedirle al programa: mostrar un aviso y reintentar la conexión
contextBridge.exposeInMainWorld('agendaDesktop', {
  notify: (title, body) => ipcRenderer.send('agenda:notify', { title, body }),
  retry: () => ipcRenderer.send('agenda:retry')
});
