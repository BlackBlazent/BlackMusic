const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');


const appDir = path.join(process.env.APPDATA, 'My Electron App');


const userDataDir = path.join(appDir, 'userData');


const cacheDir = path.join(appDir, 'cache');


function install() {

  mkdirp.sync(appDir);

 
  mkdirp.sync(userDataDir);

  
  mkdirp.sync(cacheDir);

  
  fs.copySync('app', appDir);
  fs.copySync('userData', userDataDir);
  fs.copySync('cache', cacheDir);
}


if (!fs.existsSync(appDir)) {
  install();
} else {
  console.log('The app is already installed.');
}


process.exit(0);