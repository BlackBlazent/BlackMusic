
const { remote } = require('electron');
var win = remote.getCurrentWindow();

function minimizeWindow() {
  const window = remote.getCurrentWindow();
  window.minimize();
}

function maximizeWindow() {
  const window = remote.getCurrentWindow();
  if (window.isMaximized()) {
    window.restore(); // Use restore() instead of unmaximize() for Electron 12+
  } else {
    window.maximize();
  }
}

function closeWindow() {
  const window = remote.getCurrentWindow();
  window.close();
}
