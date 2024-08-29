const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow; // Declare mainWindow outside the function

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 812,
    autoHideMenuBar: true,
    frame: false,
    closable: true,
    icon: path.join(__dirname, '..', 'AppData', 'bmusic', 'assets', 'media', 'images', 'icons', 'drawable', '256x256', 'bmusic_256.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false, // Should be true for security reasons
      enableRemoteModule: true, // Enable remote module
      devTools: true
    },
  });

  // Load the index.html of the app.
  // mainWindow.loadURL('https://www.blackmusic.com')
  // mainWindow.setTitle("BlackMusic")
  mainWindow.loadFile(path.join(__dirname, 'black-music-home.html'));
  // Open the DevTools.
  mainWindow.webContents.openDevTools({ detach: true });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

//*css*/`

// IPC handlers
ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
