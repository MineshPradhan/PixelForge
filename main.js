const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const isLinux = process.platform === 'linux';
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  const windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#18181b',
    title: 'PixelForge Studio',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };

  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  if (isLinux) {
    // Linux window managers (GNOME, KDE Plasma, XFCE) standard decorations
    windowOptions.frame = true;
  } else {
    // Windows & macOS custom dark titlebar with native caption buttons
    windowOptions.titleBarStyle = 'hidden';
    windowOptions.titleBarOverlay = {
      color: '#18181b',
      symbolColor: '#e4e4e7',
      height: 34
    };
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (e) => {
    if (!mainWindow.__forceClose) {
      e.preventDefault();
      mainWindow.webContents.send('app:request-close');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler to allow renderer to force-close after saving or discarding
ipcMain.on('app:force-close', () => {
  if (mainWindow) {
    mainWindow.__forceClose = true;
    mainWindow.close();
  }
});

// IPC handlers for native file dialogue
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Image or Project',
    filters: [
      { name: 'All Supported Formats', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'psd', 'pforge'] },
      { name: 'Photoshop Document (*.psd)', extensions: ['psd'] },
      { name: 'PixelForge Project (*.pforge)', extensions: ['pforge'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  let mime = 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
  else if (ext === 'svg') mime = 'image/svg+xml';
  else if (ext === 'webp') mime = 'image/webp';
  else if (ext === 'psd') mime = 'image/vnd.adobe.photoshop';
  else if (ext === 'pforge') mime = 'application/json';
  else mime = `image/${ext}`;

  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

  return {
    path: filePath,
    filename: path.basename(filePath),
    ext,
    dataUrl,
    rawBuffer: buffer
  };
});

ipcMain.handle('dialog:saveFile', async (event, { dataUrl, rawBase64, content, defaultName = 'project.pforge', format = 'pforge' }) => {
  const filters = [
    { name: 'PixelForge Project (*.pforge)', extensions: ['pforge'] },
    { name: 'Photoshop Document (*.psd)', extensions: ['psd'] },
    { name: 'PNG Image (*.png)', extensions: ['png'] },
    { name: 'JPEG Image (*.jpg)', extensions: ['jpg', 'jpeg'] },
    { name: 'WebP Image (*.webp)', extensions: ['webp'] },
    { name: 'Scalable Vector Graphics (*.svg)', extensions: ['svg'] },
    { name: 'All Files', extensions: ['*'] }
  ];

  if (format === 'psd') {
    filters.unshift(filters.splice(1, 1)[0]);
  } else if (format === 'png') {
    filters.unshift(filters.splice(2, 1)[0]);
  } else if (format === 'jpg' || format === 'jpeg') {
    filters.unshift(filters.splice(3, 1)[0]);
  } else if (format === 'webp') {
    filters.unshift(filters.splice(4, 1)[0]);
  } else if (format === 'svg') {
    filters.unshift(filters.splice(5, 1)[0]);
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save File / Choose Location',
    defaultPath: defaultName,
    filters
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  if (content !== undefined && content !== null) {
    fs.writeFileSync(result.filePath, content, 'utf8');
  } else if (rawBase64) {
    fs.writeFileSync(result.filePath, Buffer.from(rawBase64, 'base64'));
  } else if (dataUrl) {
    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
  }
  return result.filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
