import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from 'express-session';
import crypto from 'crypto';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

// Session secret - MUST be stable on Vercel
const SESSION_SECRET = process.env.SESSION_SECRET || 'black-bear-default-secret-change-me';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        age_group TEXT,
        location TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_content (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS coaches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT,
        bio TEXT,
        photo TEXT,
        achievements TEXT, -- JSON string
        order_index INTEGER DEFAULT 0
      );
    `);

    // Seed initial content if empty
    const contentRes = await client.query("SELECT COUNT(*) as count FROM site_content");
    if (parseInt(contentRes.rows[0].count) === 0) {
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
      for (const [key, value] of Object.entries(initialContent)) {
        await client.query("INSERT INTO site_content (key, value) VALUES ($1, $2)", [key, value]);
      }
    }

    // Seed initial coaches if empty
    const coachRes = await client.query("SELECT COUNT(*) as count FROM coaches");
    if (parseInt(coachRes.rows[0].count) === 0) {
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
      for (const c of initialCoaches) {
        await client.query("INSERT INTO coaches (name, role, bio, photo, achievements) VALUES ($1, $2, $3, $4, $5)", [c.name, c.role, c.bio, c.photo, c.achievements]);
      }
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  } finally {
    client.release();
  }
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production', 
      httpOnly: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 
    }
  }));

  const ADMIN_TOKEN = crypto.createHash('sha256').update(SESSION_SECRET + 'admin-token-v1').digest('hex');

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
      next();
    } else {
      console.log(`Auth failed. Received: ${authHeader?.substring(0, 15)}... Expected: Bearer ${ADMIN_TOKEN.substring(0, 10)}...`);
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  async function sendTelegramMessage(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    console.log('Attempting to send Telegram notification...');
    console.log(`Telegram Token exists: ${!!token}`);
    console.log(`Telegram Chat ID exists: ${!!chatId}`);
    
    if (!token || !chatId) {
      console.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.');
      return;
    }

    try {
      console.log('Sending request to Telegram API...');
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Telegram API error:', response.status, errorData);
      } else {
        console.log('Telegram message sent successfully');
      }
    } catch (e) {
      console.error('Failed to send Telegram message:', e);
    }
  }

  // Leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM leads ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.post("/api/leads", async (req, res) => {
    const { name, phone, age_group, location } = req.body;
    console.log(`New lead submission: ${name}, ${phone}`);
    try {
      await pool.query("INSERT INTO leads (name, phone, age_group, location) VALUES ($1, $2, $3, $4)", [name, phone, age_group, location]);
      console.log('Lead saved to database');
      
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
      console.error("Failed to save lead:", e);
      res.status(500).json({ error: "Failed to save lead" });
    }
  });

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    try {
      await pool.query("DELETE FROM leads WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Site Content
  app.get("/api/content", async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const result = await pool.query("SELECT * FROM site_content");
      const content = result.rows.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});
      res.json(content);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/content", requireAuth, async (req, res) => {
    const updates = req.body;
    try {
      for (const [key, value] of Object.entries(updates)) {
        await pool.query(
          'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',
          [key, String(value)]
        );
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update content' });
    }
  });

  // Coaches
  app.get("/api/coaches", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM coaches ORDER BY order_index ASC");
      res.json(result.rows.map((c: any) => ({ ...c, achievements: JSON.parse(c.achievements || '[]') })));
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch coaches" });
    }
  });

  app.post("/api/coaches", requireAuth, async (req, res) => {
    const { name, role, bio, achievements, photo } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO coaches (name, role, bio, photo, achievements) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [name, role, bio, photo, JSON.stringify(achievements || [])]
      );
      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create coach" });
    }
  });

  app.delete("/api/coaches/:id", requireAuth, async (req, res) => {
    try {
      await pool.query("DELETE FROM coaches WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete coach" });
    }
  });

  app.post('/api/coaches/:id/photo', requireAuth, async (req, res) => {
    const { photo } = req.body;
    try {
      await pool.query('UPDATE coaches SET photo = $1 WHERE id = $2', [photo, req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update photo' });
    }
  });

  app.put('/api/coaches/:id', requireAuth, async (req, res) => {
    const { name, role, bio, achievements } = req.body;
    try {
      await pool.query('UPDATE coaches SET name = $1, role = $2, bio = $3, achievements = $4 WHERE id = $5', [
        name, role, bio, JSON.stringify(achievements || []), req.params.id
      ]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update coach' });
    }
  });

  // Auth
  app.post('/api/login', (req, res) => {
    const login = (req.body.login || '').trim();
    const password = (req.body.password || '').trim();
    const expectedLogin = (process.env.ADMIN_LOGIN || 'ihorkot12').trim();
    const expectedPassword = (process.env.ADMIN_PASSWORD || '4756500ihor').trim();
    
    console.log(`Login attempt for: ${login}`);
    
    if (login === expectedLogin && password === expectedPassword) {
      console.log('Login successful');
      res.json({ success: true, token: ADMIN_TOKEN });
    } else {
      console.log('Login failed: Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get('/api/check-auth', requireAuth, (req, res) => {
    res.json({ isAdmin: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
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

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};

