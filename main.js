const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function buildApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const sendAction = (action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:menu-action', action);
    }
  };

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences / Keyboard Shortcuts...',
          accelerator: 'Cmd+,',
          click: () => sendAction('open-keyboard-shortcuts')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Canvas...',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: () => sendAction('new-file')
        },
        {
          label: 'Open Image / Project...',
          accelerator: isMac ? 'Cmd+O' : 'Ctrl+O',
          click: () => sendAction('open-file')
        },
        {
          label: 'Open Camera RAW Lab (Bayer CFA)...',
          accelerator: isMac ? 'Cmd+Shift+A' : 'Ctrl+Shift+A',
          click: () => sendAction('open-camera-raw')
        },
        { type: 'separator' },
        {
          label: 'Save Project (.pforge)...',
          accelerator: isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
          click: () => sendAction('save-project')
        },
        {
          label: 'Export as PNG...',
          accelerator: isMac ? 'Cmd+E' : 'Ctrl+E',
          click: () => sendAction('export-png')
        },
        {
          label: 'Export As... (Pro Suite)',
          accelerator: isMac ? 'Cmd+Alt+Shift+W' : 'Ctrl+Alt+Shift+W',
          click: () => sendAction('export-dialog')
        },
        { type: 'separator' },
        {
          label: 'Close Project',
          accelerator: isMac ? 'Cmd+W' : 'Ctrl+W',
          click: () => sendAction('close-project')
        },
        ...(!isMac ? [
          { type: 'separator' },
          { role: 'quit' }
        ] : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: isMac ? 'Cmd+Z' : 'Ctrl+Z',
          click: () => sendAction('undo')
        },
        {
          label: 'Redo',
          accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => sendAction('redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        {
          label: 'Free Transform',
          accelerator: isMac ? 'Cmd+T' : 'Ctrl+T',
          click: () => sendAction('free-transform')
        },
        {
          label: 'Perspective Warp...',
          click: () => sendAction('perspective-warp')
        },
        {
          label: 'Warp Transform (Bézier Mesh)...',
          accelerator: isMac ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          click: () => sendAction('transform-warp')
        },
        {
          label: 'Content-Aware Fill...',
          accelerator: 'Shift+F5',
          click: () => sendAction('content-aware-fill')
        },
        {
          label: 'Generative Fill (AI)...',
          accelerator: isMac ? 'Cmd+Alt+G' : 'Ctrl+Alt+G',
          click: () => sendAction('generative-fill')
        },
        { type: 'separator' },
        {
          label: 'Keyboard Shortcuts...',
          accelerator: isMac ? 'Cmd+Alt+Shift+K' : 'Ctrl+Alt+Shift+K',
          click: () => sendAction('open-keyboard-shortcuts')
        }
      ]
    },
    {
      label: 'Image',
      submenu: [
        {
          label: 'Curves & Levels...',
          accelerator: isMac ? 'Cmd+M' : 'Ctrl+M',
          click: () => sendAction('filter-curves')
        },
        {
          label: 'Color Balance...',
          accelerator: isMac ? 'Cmd+B' : 'Ctrl+B',
          click: () => sendAction('filter-color-balance')
        },
        {
          label: '3-Way Color Wheels Grading...',
          click: () => sendAction('color-wheels-grading')
        },
        {
          label: 'Exposure Fusion (Mertens HDR)...',
          click: () => sendAction('automate-exposure-fusion')
        }
      ]
    },
    {
      label: 'Layer',
      submenu: [
        {
          label: 'New Layer',
          accelerator: isMac ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
          click: () => sendAction('new-layer')
        },
        {
          label: 'Duplicate Layer',
          accelerator: isMac ? 'Cmd+J' : 'Ctrl+J',
          click: () => sendAction('duplicate-layer')
        },
        {
          label: 'Create / Release Clipping Mask',
          accelerator: isMac ? 'Cmd+Alt+G' : 'Ctrl+Alt+G',
          click: () => sendAction('toggle-clipping-mask')
        },
        {
          label: 'Merge Down',
          accelerator: isMac ? 'Cmd+E' : 'Ctrl+E',
          click: () => sendAction('merge-down')
        },
        {
          label: 'Merge Visible',
          accelerator: isMac ? 'Cmd+Shift+E' : 'Ctrl+Shift+E',
          click: () => sendAction('merge-visible')
        }
      ]
    },
    {
      label: 'Select',
      submenu: [
        {
          label: 'Select All',
          accelerator: isMac ? 'Cmd+A' : 'Ctrl+A',
          click: () => sendAction('select-all')
        },
        {
          label: 'Deselect',
          accelerator: isMac ? 'Cmd+D' : 'Ctrl+D',
          click: () => sendAction('deselect')
        },
        {
          label: 'Invert Selection',
          accelerator: isMac ? 'Cmd+Shift+I' : 'Ctrl+Shift+I',
          click: () => sendAction('invert-selection')
        },
        {
          label: 'Select Subject (AI)',
          click: () => sendAction('select-subject')
        },
        {
          label: 'Select and Mask (Refine Edge)...',
          click: () => sendAction('refine-edge')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: isMac ? 'Cmd+=' : 'Ctrl+=',
          click: () => sendAction('zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: isMac ? 'Cmd+-' : 'Ctrl+-',
          click: () => sendAction('zoom-out')
        },
        {
          label: '100% Actual Size',
          accelerator: isMac ? 'Cmd+1' : 'Ctrl+1',
          click: () => sendAction('zoom-100')
        },
        {
          label: 'Fit on Screen',
          accelerator: isMac ? 'Cmd+0' : 'Ctrl+0',
          click: () => sendAction('zoom-fit')
        },
        { type: 'separator' },
        {
          label: 'Show Rulers',
          accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
          click: () => sendAction('toggle-rulers')
        },
        {
          label: 'Show Grid',
          accelerator: isMac ? "Cmd+'" : "Ctrl+'",
          click: () => sendAction('toggle-grid')
        },
        {
          label: 'Show Guides',
          accelerator: isMac ? 'Cmd+;' : 'Ctrl+;',
          click: () => sendAction('toggle-guides')
        },
        {
          label: 'Snap (Magnetic & Smart)',
          accelerator: isMac ? 'Cmd+Shift+;' : 'Ctrl+Shift+;',
          click: () => sendAction('toggle-snapping')
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts Guide',
          click: () => sendAction('shortcuts-guide')
        },
        {
          label: 'About PixelForge Studio',
          click: () => sendAction('about-app')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const isLinux = process.platform === 'linux';
  const isMac = process.platform === 'darwin';
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
  } else if (isMac) {
    // macOS native seamless titlebar with traffic light buttons
    windowOptions.titleBarStyle = 'hiddenInset';
    windowOptions.trafficLightPosition = { x: 12, y: 10 };
  } else {
    // Windows custom dark titlebar with native caption buttons
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
      { name: 'All Supported Formats', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg', 'psd', 'pforge', 'hdr', 'exr', 'dng', 'cr2', 'nef', 'arw'] },
      { name: 'Photoshop Document (*.psd)', extensions: ['psd'] },
      { name: 'PixelForge Project (*.pforge)', extensions: ['pforge'] },
      { name: 'RAW & HDR Images', extensions: ['dng', 'cr2', 'nef', 'arw', 'hdr', 'exr'] },
      { name: 'Standard Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'] },
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
    { name: 'Radiance HDR (*.hdr)', extensions: ['hdr'] },
    { name: 'OpenEXR 32-bit (*.exr)', extensions: ['exr'] },
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
  } else if (format === 'hdr') {
    filters.unshift(filters.splice(6, 1)[0]);
  } else if (format === 'exr') {
    filters.unshift(filters.splice(7, 1)[0]);
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

app.whenReady().then(() => {
  buildApplicationMenu();
  createWindow();
});

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
