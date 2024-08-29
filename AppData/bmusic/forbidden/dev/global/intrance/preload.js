const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

console.log("Preload script loaded");

contextBridge.exposeInMainWorld('electron', {
  readDirectory: (relativePath) => {
    return new Promise((resolve, reject) => {
      const fullPath = path.resolve(__dirname, relativePath);
      fs.readdir(fullPath, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }
});
