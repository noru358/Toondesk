const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let win = null;
let pendingProject = null;

function isProjectPath(p) {
  return typeof p === 'string' && /\.toondesk$/i.test(p) && fs.existsSync(p);
}

function payloadFromPath(filePath) {
  if (!isProjectPath(filePath)) return null;
  return {
    name: path.basename(filePath),
    path: filePath,
    text: fs.readFileSync(filePath, 'utf8')
  };
}

function projectArg(argv) {
  return argv.find(isProjectPath) || null;
}

function deliverProject(filePath) {
  const payload = payloadFromPath(filePath);
  if (!payload) return;
  pendingProject = payload;
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) {
    win.webContents.send('toondesk:open-project-event', payload);
    pendingProject = null;
    win.show();
    win.focus();
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1460,
    height: 980,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#faf6ef',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    if (pendingProject) {
      win.webContents.send('toondesk:open-project-event', pendingProject);
      pendingProject = null;
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const p = projectArg(argv);
    if (p) deliverProject(p);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    deliverProject(filePath);
  });

  app.whenReady().then(() => {
    const initial = projectArg(process.argv);
    if (initial) pendingProject = payloadFromPath(initial);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('toondesk:open-project', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'ToonDesk 프로젝트 열기',
    properties: ['openFile'],
    filters: [
      { name: 'ToonDesk Project', extensions: ['toondesk'] },
      { name: 'JSON', extensions: ['json'] }
    ]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), path: p, text: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('toondesk:save-file', async (_event, payload) => {
  const bytes = payload?.bytes;
  if (!bytes) throw new Error('No bytes supplied');

  let target = payload?.path && !payload?.forceDialog ? String(payload.path) : null;
  if (!target) {
    const suggested = String(payload?.name || 'ToonDesk_export');
    const r = await dialog.showSaveDialog(win, {
      title: '저장',
      defaultPath: suggested
    });
    if (r.canceled || !r.filePath) return { saved: false };
    target = r.filePath;
  }

  fs.writeFileSync(target, Buffer.from(bytes));
  return { saved: true, path: target };
});

ipcMain.handle('toondesk:take-pending-project', async () => {
  const p = pendingProject;
  pendingProject = null;
  return p;
});
