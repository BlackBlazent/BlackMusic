const { app } = require('electron');
const windows = require('./windows');

app.on('ready', () => {
  if (process.platform === 'win32') {
    windows.run();
  }
});