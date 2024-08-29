const { app } = require('electron');
const macos = require('./macos');

app.on('ready', () => {
  if (process.platform === 'darwin') {
    macos.run();
  }
});