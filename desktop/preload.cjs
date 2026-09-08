const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toondeskDesktop', {
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('toondesk:get-version'),
  openProject: () => ipcRenderer.invoke('toondesk:open-project'),
  saveFile: payload => ipcRenderer.invoke('toondesk:save-file', payload),
  takePendingProject: () => ipcRenderer.invoke('toondesk:take-pending-project'),
  onOpenProject: callback => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('toondesk:open-project-event', handler);
    return () => ipcRenderer.removeListener('toondesk:open-project-event', handler);
  }
});
