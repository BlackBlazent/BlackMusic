const { app, autoUpdater } = require('electron/main')

app.whenReady().then(() => {
  const server = 'https://your-deployment-url.com'
  const feed = `${server}/update/${process.platform}/${app.getVersion()}`

 
  try {
    autoUpdater.setFeedURL(feed)
  } catch (error) {
    console.log(error)
  }


  autoUpdater.on('checking-for-update', () => {
    console.log('The autoUpdater is checking for an update')
  })

  autoUpdater.on('update-available', () => {
    console.log('The autoUpdater has found an update and is now downloading it!')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('The autoUpdater has not found any updates :(')
  })

  autoUpdater.on('update-downloaded', (event, notes, name, date) => {
    console.log('The autoUpdater has downloaded an update!')
    console.log(`The new release is named ${name} and was released on ${date}`)
    console.log(`The release notes are: ${notes}`)


    autoUpdater.quitAndInstall()
  })
})
