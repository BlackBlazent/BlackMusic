const { remote } = require('electron');
const BrowserWindow = remote.BrowserWindow;

function init() {
  // Minimize window
  document.getElementById("minimize-app").addEventListener("click", () => {
    const window = BrowserWindow.getFocusedWindow();
    window.minimize();
  });

  // Maximize/Restore window
  document.getElementById("maximize-app").addEventListener("click", () => {
    const window = BrowserWindow.getFocusedWindow();
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  // Close window
  document.getElementById("close-app").addEventListener("click", () => {
    const window = BrowserWindow.getFocusedWindow();
    window.close();
  });
}

document.onreadystatechange = () => {
  if (document.readyState === "complete") {
    init();
  }
};


