/*const sqlite3 = require('sqlite3').verbose();
const dbPath = '../../../app/database/db/allocation/local.db'; // Adjust the path to your local.db

function saveMusicList() {
    let db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
    });

    db.serialize(() => {
        // Create table if it doesn't exist
        db.run("CREATE TABLE IF NOT EXISTS music (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, artist TEXT, genre TEXT, album TEXT, duration TEXT, path TEXT, year TEXT, isFavorite BOOLEAN)", (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });

        // Clear the table before inserting new records
        db.run("DELETE FROM music", (err) => {
            if (err) {
                console.error('Error clearing table:', err.message);
            }
        });

        // Insert new records
        let stmt = db.prepare("INSERT INTO music (title, path, artist, genre, album, duration, year, isFavorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        for (let file of trackList) {
            stmt.run(file.name, file.path, 'Unknown Artist', 'Unknown Genre', 'Unknown Album', 'Unknown Duration', '0000', false, (err) => {
                if (err) {
                    console.error('Error inserting record:', err.message);
                }
            });
        }

        stmt.finalize((err) => {
            if (err) {
                console.error('Error finalizing statement:', err.message);
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
    });
}




function loadMusicList() {
    let db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
    });

    db.all("SELECT * FROM music", (err, rows) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return;
        }

        // Clear existing music display
        musicDisplayer.innerHTML = '';

        rows.forEach((row) => {
            const listItem = document.createElement('li');
            listItem.classList.add('music-local-play-listed40');
            listItem.innerHTML = `
                <div class="local-music-contents-con49">
                    <div class="music-name43">
                        <span class="music-name-tx43 local-music-title">${row.title}</span>
                    </div>
                    <div class="artist-name49">
                        <span class="artist-name-tx49 local-music-artist">${row.artist}</span>
                    </div>
                    <div class="genre-name49">
                        <span class="artist-name-tx49 local-music-genre">${row.genre}</span>
                    </div>
                    <div class="album-name49">
                        <span class="artist-name-tx49 local-music-album">${row.album}</span>
                    </div>
                    <div class="duration-name49">
                        <span class="artist-name-tx49 local-music-time">${row.duration}</span>
                    </div>
                    <div class="folder-name49">
                        <span class="artist-name-tx49 local-music-path-folder">${row.path}</span>
                    </div>
                    <div class="year-name49">
                        <span class="artist-name-tx49 local-music-year">${row.year}</span>
                    </div>
                    <div class="music-note30">
                        <img class="music-note-img-icon30" src="../AppData/bmusic/assets/media/images/icons/general/controls/music-note-img.svg">
                    </div>
            `;
            listItem.addEventListener('click', () => {
                const allItems = musicDisplayer.querySelectorAll('li');
                allItems.forEach(item => item.classList.remove('active'));
                listItem.classList.add('active');
                currentTrackIndex = Array.from(allItems).indexOf(listItem);
                loadTrack(currentTrackIndex);
                if (isPlaying) audioElement.play();
            });

            musicDisplayer.appendChild(listItem);
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        }
    });
}

// Call loadMusicList on page load to display saved music
document.addEventListener('DOMContentLoaded', () => {
    loadMusicList(); // Load saved music list when the app starts
    // Other initialization code...
});
*/

// Assuming you're using Electron and have access to the SQLite3 library

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ensure this path is correct relative to your app’s directory structure
const dbPath = path.join(__dirname, '../../../app/database/db/allocation/local.db');

function initializeDatabase() {
    let db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Database opened successfully.');
    });

    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS music (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                artist TEXT,
                genre TEXT,
                album TEXT,
                duration TEXT,
                path TEXT,
                year TEXT,
                isFavorite BOOLEAN
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Table created or already exists.');
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database closed successfully.');
        }
    });
}

initializeDatabase(); // Call this function when your app starts

function saveMusicList(trackList) {
    let db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Database opened successfully.');
    });

    db.serialize(() => {
        // Clear existing data
        db.run("DELETE FROM music", (err) => {
            if (err) {
                console.error('Error clearing table:', err.message);
                return;
            }
            console.log('Table cleared.');
        });

        // Insert new records
        let stmt = db.prepare("INSERT INTO music (title, path, artist, genre, album, duration, year, isFavorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        trackList.forEach(file => {
            stmt.run(file.title, file.path, file.artist, file.genre, file.album, file.duration, file.year, file.isFavorite, (err) => {
                if (err) {
                    console.error('Error inserting record:', err.message);
                } else {
                    console.log(`Record inserted: ${file.title}`);
                }
            });
        });

        stmt.finalize((err) => {
            if (err) {
                console.error('Error finalizing statement:', err.message);
            } else {
                console.log('Statement finalized.');
            }
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database closed successfully.');
        }
    });
}

function loadMusicList() {
    let db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            return;
        }
        console.log('Database opened successfully.');
    });

    db.all("SELECT * FROM music", (err, rows) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return;
        }

        console.log(`Loaded ${rows.length} rows from the database.`);

        // Ensure musicDisplayer is correctly selected
        const musicDisplayer = document.querySelector('#music-displayer');
        if (!musicDisplayer) {
            console.error('Music displayer element not found.');
            return;
        }

        // Clear existing display
        musicDisplayer.innerHTML = '';

        rows.forEach((row) => {
            const listItem = document.createElement('li');
            listItem.classList.add('music-local-play-listed40');
            listItem.innerHTML = `
                <div class="local-music-contents-con49">
                    <div class="music-name43">
                        <span class="music-name-tx43 local-music-title">${row.title}</span>
                    </div>
                    <div class="artist-name49">
                        <span class="artist-name-tx49 local-music-artist">${row.artist}</span>
                    </div>
                    <div class="genre-name49">
                        <span class="artist-name-tx49 local-music-genre">${row.genre}</span>
                    </div>
                    <div class="album-name49">
                        <span class="artist-name-tx49 local-music-album">${row.album}</span>
                    </div>
                    <div class="duration-name49">
                        <span class="artist-name-tx49 local-music-time">${row.duration}</span>
                    </div>
                    <div class="folder-name49">
                        <span class="artist-name-tx49 local-music-path-folder">${row.path}</span>
                    </div>
                    <div class="year-name49">
                        <span class="artist-name-tx49 local-music-year">${row.year}</span>
                    </div>
                    <div class="music-note30">
                        <img class="music-note-img-icon30" src="../AppData/bmusic/assets/media/images/icons/general/controls/music-note-img.svg">
                    </div>
            `;
            listItem.addEventListener('click', () => {
                const allItems = musicDisplayer.querySelectorAll('li');
                allItems.forEach(item => item.classList.remove('active'));
                listItem.classList.add('active');
                currentTrackIndex = Array.from(allItems).indexOf(listItem);
                loadTrack(currentTrackIndex);
                if (isPlaying) audioElement.play();
            });

            musicDisplayer.appendChild(listItem);
        });
    });

    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database closed successfully.');
        }
    });
}












