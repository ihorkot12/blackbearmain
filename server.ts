import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from 'express-session';
import crypto from 'crypto';

dotenv.config();

// Session secret
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("dojo.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age_group TEXT,
    location TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_content (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    bio TEXT,
    photo TEXT,
    achievements TEXT, -- JSON array
    order_index INTEGER DEFAULT 0
  );
`);

// Migration: Add location column to leads if it doesn't exist
try {
  db.exec("ALTER TABLE leads ADD COLUMN location TEXT;");
} catch (e) {
  // Column might already exist, ignore
}

// Seed initial content if empty
const contentCount = db.prepare("SELECT COUNT(*) as count FROM site_content").get() as { count: number };
if (contentCount.count === 0) {
  const initialContent = {
    "hero_title": "Карате Київ <br> <span class='text-red-600'>Для дітей</span>",
    "hero_subtitle": "Формуємо дисципліну, силу та впевненість. Професійна секція карате Київ для вашої дитини.",
    "hero_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
    "about_title": "Шлях порожньої руки",
    "about_text": "Black Bear Dojo — це не просто спортивна секція. Це місце, де гартується характер. Ми практикуємо Кіокушинкай карате — один із найсильніших та найдисциплінованіших стилів бойових мистецтв у світі.",
    "about_image": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1000&auto=format&fit=crop",
    "coach_name": "Ігор Котляревський",
    "coach_role": "Сенсей, Чорний пояс 3-й дан",
    "coach_bio": "Понад 15 років досвіду викладання. Виховав десятки чемпіонів України та Європи. Його підхід базується на поєднанні традиційної етики карате та сучасних методик фізичного розвитку.",
    "coach_photo": "https://picsum.photos/seed/coach/800/1000"
  };
  const insert = db.prepare("INSERT INTO site_content (key, value) VALUES (?, ?)");
  Object.entries(initialContent).forEach(([key, value]) => {
    insert.run(key, value);
  });
}

// Seed initial coaches if empty
const coachCount = db.prepare("SELECT COUNT(*) as count FROM coaches").get() as { count: number };
if (coachCount.count === 0) {
  const initialCoaches = [
    {
      name: "Ігор Котляревський",
      role: "Засновник клубу",
      bio: "Моя мета — не просто навчити битися, а сформувати характер, який допоможе дитині перемагати в житті.",
      photo: "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=800&auto=format&fit=crop",
      achievements: JSON.stringify(["3 дан карате Кіокушинкай", "Майстер спорту України", "Чемпіон України", "Призер чемпіонатів Європи"])
    },
    {
      name: "Олег Крамаренко",
      role: "Провідний тренер",
      bio: "Кожне тренування — це перемога над собою. Ми вчимо дітей не здаватися перед труднощами.",
      photo: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop",
      achievements: JSON.stringify(["10 років тренерської практики", "Підготовка до змагань", "Всеукраїнський та міжнародний рівень"])
    }
  ];
  const insertCoach = db.prepare("INSERT INTO coaches (name, role, bio, photo, achievements) VALUES (?, ?, ?, ?, ?)");
  initialCoaches.forEach(c => {
    insertCoach.run(c.name, c.role, c.bio, c.photo, c.achievements);
  });
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true); // Trust all proxies for secure cookies
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: true, 
      httpOnly: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 
    }
  }));

  // --- API Routes ---
  const ADMIN_TOKEN = crypto.randomBytes(32).toString('hex');

  // Middleware to check token
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  async function sendTelegramMessage(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.log("Telegram credentials missing, skipping notification");
      return;
    }

    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });
    } catch (e) {
      console.error('Failed to send Telegram message', e);
    }
  }

  // Leads
  app.get("/api/leads", requireAuth, (req, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(leads);
  });

  app.post("/api/leads", async (req, res) => {
    const { name, phone, age_group, location } = req.body;
    try {
      db.prepare("INSERT INTO leads (name, phone, age_group, location) VALUES (?, ?, ?, ?)").run(name, phone, age_group, location);
      
      // Send Telegram Notification
      const message = `
<b>🔔 Нова заявка на пробне заняття!</b>
<b>Ім'я:</b> ${name}
<b>Телефон:</b> ${phone}
<b>Вікова група:</b> ${age_group}
<b>Локація:</b> ${location || 'Не вказано'}
      `;
      await sendTelegramMessage(message);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save lead" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, (req, res) => {
    try {
      db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Site Content
  app.get("/api/content", (req, res) => {
    const content = db.prepare("SELECT * FROM site_content").all() as any[];
    const result = content.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    res.json(result);
  });

  app.post("/api/content", requireAuth, (req, res) => {
    const updates = req.body;
    try {
      const stmt = db.prepare('INSERT INTO site_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      const transaction = db.transaction((updates) => {
        for (const [key, value] of Object.entries(updates)) {
          stmt.run(key, String(value));
        }
      });
      transaction(updates);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update content' });
    }
  });

  // Coaches
  app.get("/api/coaches", (req, res) => {
    const coaches = db.prepare("SELECT * FROM coaches ORDER BY order_index ASC").all();
    res.json(coaches.map((c: any) => ({ ...c, achievements: JSON.parse(c.achievements || '[]') })));
  });

  app.post('/api/coaches/:id/photo', requireAuth, (req, res) => {
    const { photo } = req.body;
    try {
      db.prepare('UPDATE coaches SET photo = ? WHERE id = ?').run(photo, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update photo' });
    }
  });

  app.put('/api/coaches/:id', requireAuth, (req, res) => {
    const { name, role, bio, achievements } = req.body;
    try {
      db.prepare('UPDATE coaches SET name = ?, role = ?, bio = ?, achievements = ? WHERE id = ?').run(
        name, role, bio, JSON.stringify(achievements || []), req.params.id
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update coach' });
    }
  });

  // Auth
  app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const expectedLogin = process.env.ADMIN_LOGIN || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'password';
    
    if (login === expectedLogin && password === expectedPassword) {
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/check-auth', requireAuth, (req, res) => {
    res.json({ isAdmin: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
