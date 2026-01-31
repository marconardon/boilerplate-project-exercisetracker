const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const sqlite3 = require('sqlite3').verbose()
require('dotenv').config()

// Basic Configuration
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// SQLite Database Connection
const db = new sqlite3.Database('./exercise.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the exercise database.');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    description TEXT NOT NULL,
    duration INTEGER NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users (id)
  )`);
});

// API Endpoints
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  const sql = `INSERT INTO users (id, username) VALUES (?, ?)`;
  db.run(sql, [id, username], function(err) {
    if (err) {
      // Check for unique constraint error
      if (err.code === 'SQLITE_CONSTRAINT') {
        // Find the existing user and return it
        db.get(`SELECT id, username FROM users WHERE username = ?`, [username], (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Server error' });
          }
          res.json({ username: row.username, _id: row.id });
        });
        return;
      }
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({ username, _id: id });
  });
});

app.get('/api/users', (req, res) => {
  db.all("SELECT id as _id, username FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    res.json(rows);
  });
});

app.post('/api/users/:_id/exercises', (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;
  const exerciseDate = date ? new Date(date) : new Date();

  db.get("SELECT id, username FROM users WHERE id = ?", [_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sql = `INSERT INTO exercises (userId, description, duration, date) VALUES (?, ?, ?, ?)`;
    db.run(sql, [_id, description, parseInt(duration), exerciseDate.toISOString()], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({
        _id: user.id,
        username: user.username,
        description,
        duration: parseInt(duration),
        date: exerciseDate.toDateString()
      });
    });
  });
});

app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  db.get("SELECT id, username FROM users WHERE id = ?", [_id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Server error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let sql = "SELECT description, duration, date FROM exercises WHERE userId = ?";
    const params = [_id];

    if (from) {
      sql += " AND date >= ?";
      params.push(new Date(from).toISOString());
    }
    if (to) {
      sql += " AND date <= ?";
      params.push(new Date(to).toISOString());
    }
    if (limit) {
      sql += " LIMIT ?";
      params.push(parseInt(limit));
    }

    db.all(sql, params, (err, exercises) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      const log = exercises.map(e => ({
        description: e.description,
        duration: e.duration,
        date: new Date(e.date).toDateString()
      }));

      res.json({
        _id: user.id,
        username: user.username,
        count: log.length,
        log
      });
    });
  });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})