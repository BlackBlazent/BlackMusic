/*const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const SQLite3 = require('sqlite3').verbose();
const db = new SQLite3.Database('../../../app/database/db/allocation/local.db');

// Ensure database table exists
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS music (
    title TEXT,
    artist TEXT,
    genre TEXT,
    album TEXT,
    duration TEXT,
    coverImage TEXT,
    path TEXT,
    year TEXT,
    isFavorite BOOLEAN
  )`);
});

// Handle folder upload
document.getElementById('file-upload').addEventListener('change', (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    // Process each file and extract metadata
    Array.from(files).forEach(file => {
      // Use a library to read metadata from music files (e.g., music-metadata)
      // Assuming metadata extraction is done here
      const musicData = extractMetadata(file);

      // Save to SQLite database
      db.run(`INSERT INTO music (title, artist, genre, album, duration, coverImage, path, year, isFavorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        musicData.title,
        musicData.artist,
        musicData.genre,
        musicData.album,
        musicData.duration,
        musicData.coverImage,
        file.path,
        musicData.year,
        musicData.isFavorite
      ]);
    });

    // Reload music list
    loadMusicData();
  }
});

function extractMetadata(file) {
  // Placeholder for extracting music metadata
  return {
    title: path.basename(file.name, path.extname(file.name)), // Placeholder
    artist: 'Unknown Artist',
    genre: 'Unknown Genre',
    album: 'Unknown Album',
    duration: '0:00',
    coverImage: '',
    year: '0000',
    isFavorite: false
  };
}

// Function to load music data from SQLite and render
async function loadMusicData() {
  db.all('SELECT * FROM music', [], (err, rows) => {
    if (err) {
      throw err;
    }

    renderMusicList(rows);
  });
}

// Call loadMusicData to initialize the music list
loadMusicData();*/
