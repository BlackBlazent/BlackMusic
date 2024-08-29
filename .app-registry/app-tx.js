const { app } = require('electron/main')

app.whenReady().then(() => console.log('The app is now ready for action'))

app.on('browser-window-created', () => console.log('A window was created!'))
app.on('browser-window-focus', () => console.log('...and focused!'))

console.log(`The app lives at: ${app.getAppPath()}`)
console.log(`It's named: ${app.name}`)
console.log(`It has the version: ${app.getVersion()}`)
