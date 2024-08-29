const { app } = require('electron');
const android = require('./android');

app.on('ready', () => {
  if (process.platform === 'android') {
    android.run();
  }
});