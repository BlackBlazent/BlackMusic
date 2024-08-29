const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./mydatabase.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS mytable (id INTEGER PRIMARY KEY)`);
    db.run(`INSERT INTO mytable (id) VALUES (1)`);
    db.run(`INSERT INTO mytable (id) VALUES (2)`);
});

db.close((err) => {
    if (err) throw err;
});