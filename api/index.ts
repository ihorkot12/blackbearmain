import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;
const db = new Database('dojo.db');

// Telegram Helper
async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('Telegram token or chat ID missing');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

// Initialize database tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    photo TEXT,
    bio TEXT,
    achievements TEXT,
    specialization TEXT,
    instagram TEXT
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    map_url TEXT,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER,
    group_name TEXT,
    days TEXT,
    time TEXT,
    age_range TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age_group TEXT,
    location TEXT,
    status TEXT DEFAULT 'new',
    value INTEGER DEFAULT 0,
    coach_id INTEGER,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    group_id INTEGER,
    rank TEXT,
    rating INTEGER DEFAULT 0,
    birth_date TEXT,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id INTEGER,
    amount INTEGER NOT NULL,
    type TEXT,
    month INTEGER,
    year INTEGER,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (participant_id) REFERENCES participants(id)
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  );
`);

// Ensure columns exist in 'leads' table
try { db.prepare("ALTER TABLE leads ADD COLUMN source TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE leads ADD COLUMN age_group TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE leads ADD COLUMN location TEXT").run(); } catch (e) {}

// Seed default admin if not exists
const adminExists = db.prepare('SELECT * FROM admin_users WHERE login = ?').get('ihorkot12');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('4756500ihor', 10);
  db.prepare('INSERT INTO admin_users (login, password, role, name) VALUES (?, ?, ?, ?)').run('ihorkot12', hashedPassword, 'admin', 'Ihor Kot');
}

app.use(express.json());
app.use(session({
  secret: 'dojo_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// API Routes
app.get('/api/init', (req, res) => {
  const content = db.prepare('SELECT * FROM site_content').all();
  const coaches = db.prepare('SELECT * FROM coaches').all();
  const locations = db.prepare('SELECT * FROM locations').all();
  const schedule = db.prepare('SELECT * FROM schedule').all();
  
  const contentMap = content.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  res.json({
    content: contentMap,
    coaches,
    locations,
    schedule
  });
});

app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  const user: any = db.prepare('SELECT * FROM admin_users WHERE login = ?').get(login);
  
  if (user && bcrypt.compareSync(password, user.password)) {
    res.json({
      token: 'mock_token_' + user.id,
      role: user.role,
      name: user.name
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/dashboard/stats', (req, res) => {
  const totals = {
    total_participants: db.prepare('SELECT COUNT(*) as count FROM participants WHERE status = "active"').get().count,
    unpaid_participants: db.prepare('SELECT COUNT(*) as count FROM participants WHERE status = "unpaid"').get().count,
    new_leads: db.prepare('SELECT COUNT(*) as count FROM leads WHERE status = "new"').get().count,
    total_locations: db.prepare('SELECT COUNT(*) as count FROM locations').get().count,
    total_coaches: db.prepare('SELECT COUNT(*) as count FROM coaches').get().count,
  };

  const recentLeads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT 5').all();
  
  // Mock leads over time for chart
  const leadsOverTime = [
    { date: new Date(Date.now() - 6*24*60*60*1000).toISOString().split('T')[0], count: 2 },
    { date: new Date(Date.now() - 5*24*60*60*1000).toISOString().split('T')[0], count: 5 },
    { date: new Date(Date.now() - 4*24*60*60*1000).toISOString().split('T')[0], count: 3 },
    { date: new Date(Date.now() - 3*24*60*60*1000).toISOString().split('T')[0], count: 8 },
    { date: new Date(Date.now() - 2*24*60*60*1000).toISOString().split('T')[0], count: 4 },
    { date: new Date(Date.now() - 1*24*60*60*1000).toISOString().split('T')[0], count: 6 },
    { date: new Date().toISOString().split('T')[0], count: 10 },
  ];

  const groupDistribution = db.prepare(`
    SELECT l.name as group_name, COUNT(p.id) as count 
    FROM locations l 
    LEFT JOIN participants p ON l.id = p.location_id 
    GROUP BY l.id
  `).all();

  res.json({
    totals,
    recentLeads,
    leadsOverTime,
    groupDistribution
  });
});

app.get('/api/participants', (req, res) => {
  const { search } = req.query;
  let participants;
  if (search) {
    participants = db.prepare('SELECT * FROM participants WHERE name LIKE ?').all(`%${search}%`);
  } else {
    participants = db.prepare('SELECT * FROM participants').all();
  }
  res.json(participants);
});

app.get('/api/leads', (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.json(leads);
});

app.post('/api/leads', async (req, res) => {
  const { name, phone, age_group, location, source } = req.body;
  const result = db.prepare('INSERT INTO leads (name, phone, age_group, location, source) VALUES (?, ?, ?, ?, ?)').run(name, phone, age_group, location, source || 'Unknown');
  
  // Send Telegram Notification
  const message = `🚀 <b>Нова заявка!</b>\n\n👤 Ім'я: ${name}\n📞 Телефон: ${phone}\n🏢 Локація: ${location || 'Не вказано'}\n👥 Група: ${age_group || 'Не вказано'}\n📍 Джерело: ${source || 'Не вказано'}`;
  await sendTelegramMessage(message);

  res.json({ id: result.lastInsertRowid });
});

app.put('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const { status, value, coach_id } = req.body;
  db.prepare('UPDATE leads SET status = ?, value = ?, coach_id = ? WHERE id = ?').run(status, value, coach_id, id);
  res.json({ success: true });
});

app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  res.json({ success: true });
});

app.get('/api/payments', (req, res) => {
  const { month, year } = req.query;
  const payments = db.prepare(`
    SELECT p.*, part.name as participant_name 
    FROM payments p 
    JOIN participants part ON p.participant_id = part.id 
    WHERE p.month = ? AND p.year = ?
  `).all(month, year);
  res.json(payments);
});

app.post('/api/payments', (req, res) => {
  const { participant_id, amount, type, month, year, notes } = req.body;
  const result = db.prepare('INSERT INTO payments (participant_id, amount, type, month, year, notes) VALUES (?, ?, ?, ?, ?, ?)').run(participant_id, amount, type, month, year, notes);
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/birthdays', (req, res) => {
  const today = new Date();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  const searchStr = `%-` + month + `-` + day;
  const birthdays = db.prepare('SELECT * FROM participants WHERE birth_date LIKE ?').all(searchStr);
  res.json(birthdays);
});

app.get('/api/coaches', (req, res) => {
  const coaches = db.prepare('SELECT * FROM coaches').all();
  res.json(coaches);
});

app.get('/api/locations', (req, res) => {
  const locations = db.prepare('SELECT * FROM locations').all();
  res.json(locations);
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
