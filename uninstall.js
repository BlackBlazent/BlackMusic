const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');


const appDir = path.join(process.env.APPDATA, 'My Electron App');


const userDataDir = path.join(appDir, 'userData');


const cacheDir = path.join(appDir, 'cache');


function uninstall() {
 
  rimraf.sync(appDir);

  
  rimraf.sync(userDataDir);

 
  rimraf.sync(cacheDir);
}


if (fs.existsSync(appDir)) {
  uninstall();
} else {
  console.log('The app is not installed.');
}

// Exit the script
process.exit(0);