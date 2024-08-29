const { app } = require('electron');
const ios = require('./ios');

app.on('ready', () => {
  if (process.platform === 'darwin') {
    ios.run();
  }
});