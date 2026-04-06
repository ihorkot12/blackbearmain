import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import session from 'express-session';
import crypto from 'crypto';
import pkg from 'pg';
import compression from 'compression';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import * as xlsx from 'xlsx';
import cron from 'node-cron';
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
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Database features will be disabled.");
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'coach', -- 'admin' or 'coach'
        name TEXT,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL
      );

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

      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        map_link TEXT,
        order_index INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        day_of_week TEXT NOT NULL, -- e.g. "Пн", "Вт" or "Monday"
        start_time TEXT NOT NULL,
        end_time TEXT,
        group_name TEXT,
        price TEXT,
        order_index INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        order_index INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        birthday DATE,
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        parent_login TEXT UNIQUE,
        parent_password TEXT,
        belt TEXT DEFAULT 'Білий',
        rank_points INTEGER DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status TEXT NOT NULL, -- 'present', 'absent'
        UNIQUE(participant_id, date)
      );

      CREATE TABLE IF NOT EXISTS badges (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE
      );

      CREATE TABLE IF NOT EXISTS competitions (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'competition', -- 'competition', 'club_event', 'certification', 'seminar'
        result TEXT,
        date DATE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        data TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS points_log (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        reference_id TEXT, -- To link to specific badge or competition
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE points_log ADD COLUMN IF NOT EXISTS reference_id TEXT;

      ALTER TABLE schedule ADD COLUMN IF NOT EXISTS price TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS belt TEXT DEFAULT 'Білий';
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL;
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS rank_points INTEGER DEFAULT 0;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    `);

    // Seed initial admin if empty
    const adminRes = await client.query("SELECT COUNT(*) as count FROM admin_users");
    if (parseInt(adminRes.rows[0].count) === 0) {
      const initialLogin = (process.env.ADMIN_LOGIN || 'ihorkot12').trim();
      const initialPasswordRaw = (process.env.ADMIN_PASSWORD || '4756500').trim();
      const hashedPassword = await bcrypt.hash(initialPasswordRaw, 10);
      await client.query(
        "INSERT INTO admin_users (login, password, role, name) VALUES ($1, $2, $3, $4)",
        [initialLogin, hashedPassword, 'admin', 'Ігор Котляревський']
      );
    }

    // Seed initial groups if empty
    const groupRes = await client.query("SELECT COUNT(*) as count FROM groups");
    if (parseInt(groupRes.rows[0].count) === 0) {
      const locs = await client.query("SELECT id FROM locations LIMIT 1");
      if (locs.rows.length > 0) {
        const locId = locs.rows[0].id;
        await client.query("INSERT INTO groups (name, location_id) VALUES ($1, $2)", ["Молодша група", locId]);
        await client.query("INSERT INTO groups (name, location_id) VALUES ($1, $2)", ["Середня група", locId]);
        await client.query("INSERT INTO groups (name, location_id) VALUES ($1, $2)", ["Старша група", locId]);
      }
    }

    // Seed initial content if empty
    const contentRes = await client.query("SELECT COUNT(*) as count FROM site_content");
    if (parseInt(contentRes.rows[0].count) === 0) {
      const initialContent = {
        "hero_title": "BLACK BEAR DOJO <br> <span class='text-red-600'>КАРАТЕ КИЇВ</span>",
        "hero_subtitle": "Формуємо дисципліну, силу та впевненість. Професійна секція карате для вашої дитини від 4 років.",
        "hero_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "hero_button": "Записатись на пробне",
        "transformation_title": "ТРАНСФОРМАЦІЯ",
        "transformation_subtitle": "Від новачка до чемпіона — шлях, який змінює життя назавжди.",
        "transformation_bg": "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1920&auto=format&fit=crop",
        "how_title": "ЯК ЦЕ ПРАЦЮЄ",
        "how_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "how_step1_title": "ЗАПИС",
        "how_step1_text": "Залиште заявку на сайті або зателефонуйте нам для консультації.",
        "how_step2_title": "ПРОБНЕ",
        "how_step2_text": "Приходьте на перше безкоштовне заняття для знайомства з тренером.",
        "how_step3_title": "РЕЗУЛЬТАТ",
        "how_step3_text": "Починайте регулярні тренування та спостерігайте за прогресом дитини.",
        "about_title": "ШЛЯХ ПОРОЖНЬОЇ РУКИ",
        "about_text": "Black Bear Dojo — це не просто спортивна секція. Це місце, де гартується характер. Ми практикуємо Кіокушинкай карате — один із найсильніших та найдисциплінованіших стилів бойових мистецтв у світі.",
        "about_image": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1000&auto=format&fit=crop",
        "about_quote": "Карате починається і закінчується ввічливістю.",
        "directions_title": "НАПРЯМИ НАВЧАННЯ",
        "directions_subtitle": "Ми пропонуємо комплексну програму розвитку для дітей різного віку та рівня підготовки.",
        "directions_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "dir1_title": "КІОКУШИНКАЙ",
        "dir1_text": "Повноконтактний стиль карате, що розвиває неймовірну силу духу та витривалість.",
        "dir2_title": "ФІЗИЧНИЙ РОЗВИТОК",
        "dir2_text": "Загальна фізична підготовка, гнучкість, координація та зміцнення імунітету.",
        "dir3_title": "ДИСЦИПЛІНА",
        "dir3_text": "Виховання поваги, самоконтролю та лідерських якостей у кожному учні.",
        "results_title": "НАШІ РЕЗУЛЬТАТИ",
        "results_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "results_image": "https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=1000&auto=format&fit=crop",
        "results_image_title": "СИСТЕМНА ПІДГОТОВКА",
        "results_image_subtitle": "Від білого до чорного поясу",
        "schedule_title": "РОЗКЛАД ЗАНЯТЬ",
        "schedule_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "reviews_title": "ВІДГУКИ БАТЬКІВ",
        "reviews_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "faq_title": "ЧАСТІ ЗАПИТАННЯ",
        "faq_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "contact_title": "ЗАПИСАТИСЬ НА ПРОБНЕ",
        "contact_bg": "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1920&auto=format&fit=crop",
        "contact_phone": "+38 (067) 123-45-67",
        "contact_email": "info@blackbeardojo.com",
        "social_instagram": "https://instagram.com/karate_kyiv",
        "social_facebook": "https://facebook.com/karate_kyiv",
        "meta_pixel_code": "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '2370050340139768');fbq('track', 'PageView');</script>\n<noscript><img height=\"1\" width=\"1\" style=\"display:none\" src=\"https://www.facebook.com/tr?id=2370050340139768&ev=PageView&noscript=1\" /></noscript>",
        "google_pixel_code": "<!-- Google tag (gtag.js) -->\n<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX\"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXXXXX');\n</script>",
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "video_title": "Відчуйте енергію тренувань",
        "problems_title": "Ваша дитина:",
        "problems_subtitle": "Наша секція карате Київ допомагає батькам виховувати сильних особистостей. <br /> <span class=\"text-red-500\">Ми перетворюємо слабкість на силу.</span>",
        "problem1": "Невпевнена у власних силах?",
        "problem2": "Багато часу проводить у телефоні?",
        "problem3": "Потребує дисципліни та фізичного розвитку?",
        "problem4": "Має труднощі у спілкуванні з однолітками?",
        "problem5": "Відчуває брак фізичної активності?",
        "problem6": "Потребує сильного оточення та наставника?"
      };
      for (const [key, value] of Object.entries(initialContent)) {
        await client.query("INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [key, value]);
      }
    } else {
      // Ensure new keys are added even if content already exists
      const newKeys = {
        "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "video_title": "Відчуйте енергію тренувань",
        "problems_title": "Ваша дитина:",
        "problems_subtitle": "Наша секція карате Київ допомагає батькам виховувати сильних особистостей. <br /> <span class=\"text-red-500\">Ми перетворюємо слабкість на силу.</span>",
        "problem1": "Невпевнена у власних силах?",
        "problem2": "Багато часу проводить у телефоні?",
        "problem3": "Потребує дисципліни та фізичного розвитку?",
        "problem4": "Має труднощі у спілкуванні з однолітками?",
        "problem5": "Відчуває брак фізичної активності?",
        "problem6": "Потребує сильного оточення та наставника?"
      };
      for (const [key, value] of Object.entries(newKeys)) {
        await client.query("INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING", [key, value]);
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
          photo: "https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=800&auto=format&fit=crop",
          achievements: JSON.stringify(["10 років тренерської практики", "Підготовка до змагань", "Всеукраїнський та міжнародний рівень"])
        }
      ];
      for (const c of initialCoaches) {
        await client.query("INSERT INTO coaches (name, role, bio, photo, achievements) VALUES ($1, $2, $3, $4, $5)", [c.name, c.role, c.bio, c.photo, c.achievements]);
      }
    }

    // Seed initial locations if empty
    const locRes = await client.query("SELECT COUNT(*) as count FROM locations");
    if (parseInt(locRes.rows[0].count) === 0) {
      const shulyavka = await client.query(
        "INSERT INTO locations (name, address, map_link, order_index) VALUES ($1, $2, $3, $4) RETURNING id",
        ["Шулявка", "вул. Сім'ї Бродських, 31/33\nКиїв, 03057 (м. Шулявська)", "https://maps.app.goo.gl/9Z9Z9Z", 0]
      );
      const nekrasova = await client.query(
        "INSERT INTO locations (name, address, map_link, order_index) VALUES ($1, $2, $3, $4) RETURNING id",
        ["Віктора Некрасова", "вул. Віктора Некрасова, 1-3\nКиїв, 04136", "https://maps.app.goo.gl/8Y8Y8Y", 1]
      );

      // Seed initial schedule if empty
      const schedRes = await client.query("SELECT COUNT(*) as count FROM schedule");
      if (parseInt(schedRes.rows[0].count) === 0) {
        const coachIgor = await client.query("SELECT id FROM coaches WHERE name = 'Ігор Котляревський' LIMIT 1");
        const coachOleg = await client.query("SELECT id FROM coaches WHERE name = 'Олег Крамаренко' LIMIT 1");
        
        const igorId = coachIgor.rows[0]?.id;
        const olegId = coachOleg.rows[0]?.id;

        // Shulyavka Schedule
        const shulyavkaId = shulyavka.rows[0].id;
        const shulyavkaSchedule = [
          { day: "Пн, Ср, Пт", start: "17:00", end: "17:40", group: "Молодша група (4–7 років)", price: "2500", coachId: igorId },
          { day: "Пн, Ср, Пт", start: "18:00", end: "19:00", group: "Середня група (7–12 років)", price: "2500", coachId: igorId },
          { day: "Пн, Ср, Пт", start: "19:00", end: "20:30", group: "Старша група (12+ років)", price: "2500", coachId: igorId },
          { day: "Сб", start: "10:00", end: "11:30", group: "Спецклас (всі вікові групи)", price: "2500", coachId: olegId }
        ];
        for (const s of shulyavkaSchedule) {
          await client.query(
            "INSERT INTO schedule (location_id, coach_id, day_of_week, start_time, end_time, group_name, price) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [shulyavkaId, s.coachId, s.day, s.start, s.end, s.group, s.price]
          );
        }

        // Nekrasova Schedule
        const nekrasovaId = nekrasova.rows[0].id;
        const nekrasovaSchedule = [
          { day: "Пн, Ср, Пт", start: "17:00", end: "18:00", group: "Група (5–7 років)", price: "2500" },
          { day: "Пн, Ср, Пт", start: "18:00", end: "19:00", group: "Група (8–12 років)", price: "2500" }
        ];
        for (const s of nekrasovaSchedule) {
          await client.query(
            "INSERT INTO schedule (location_id, coach_id, day_of_week, start_time, end_time, group_name, price) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [nekrasovaId, olegId, s.day, s.start, s.end, s.group, s.price]
          );
        }
      }
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  } finally {
    if (client) client.release();
  }
}

async function startServer() {
  await initDb();
  
  const app = express();
  const PORT = 3000;

  // Trust the first proxy (Cloud Run / Nginx)
  app.set('trust proxy', 1);
  
  // Security and Performance Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for easier integration of external scripts if needed, or configure properly
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  
  // General API Rate Limiter
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300, // limit each IP to 300 requests per minute
    message: { error: 'Занадто багато запитів. Спробуйте пізніше.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });
  app.use('/api/', apiLimiter);
  
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

  const ADMIN_TOKEN = crypto.createHash('sha256').update(SESSION_SECRET + 'admin-token-v1').digest('hex');

  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
      (req as any).user = { role: 'admin', login: 'system' };
      return next();
    }

    // Check for custom tokens (simple implementation for now)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const result = await pool.query("SELECT * FROM admin_users WHERE id::text = $1", [token.split('-')[0]]);
        if (result.rows.length > 0) {
          (req as any).user = result.rows[0];
          return next();
        }
      } catch (e) {
        console.error('Auth error:', e);
      }
    }

    console.log(`Auth failed. Received: ${authHeader?.substring(0, 15)}...`);
    res.status(401).json({ error: 'Unauthorized' });
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

  async function sendMetaEvent(eventName: string, userData: any, req: express.Request) {
    const pixelId = process.env.META_PIXEL_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!pixelId || !accessToken) {
      console.warn('Meta CAPI skipped: META_PIXEL_ID or META_ACCESS_TOKEN is missing.');
      return;
    }

    const hash = (val: string) => {
      if (!val) return undefined;
      return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
    };

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: req.headers.referer || '',
          event_id: userData.event_id,
          user_data: {
            client_ip_address: req.ip,
            client_user_agent: req.headers['user-agent'],
            ph: userData.phone ? [hash(userData.phone)] : undefined,
            fn: userData.name ? [hash(userData.name)] : undefined,
          },
        },
      ],
    };

    try {
      console.log(`Sending Meta CAPI event: ${eventName} (ID: ${userData.event_id})`);
      const response = await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Meta CAPI error:', response.status, errorData);
      } else {
        console.log('Meta CAPI event sent successfully');
      }
    } catch (e) {
      console.error('Failed to send Meta CAPI event:', e);
    }
  }

  // Leads
  app.get("/api/leads", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      // Limit to 100 most recent leads to save bandwidth/quota
      const result = await pool.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 100");
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Delete all leads
  app.delete('/api/leads/delete-all', requireAuth, async (req, res) => {
    try {
      await pool.query('DELETE FROM leads');
      res.json({ message: 'All leads deleted' });
    } catch (e) {
      console.error('Delete all leads failed', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Lead Submission Rate Limiter
  const leadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: 'Ви вже надіслали кілька заявок. Будь ласка, зачекайте 15 хвилин.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });

  app.post("/api/leads", leadLimiter, async (req, res) => {
    const { name, phone, age_group, location, event_id, source } = req.body;
    console.log(`New lead submission: ${name}, ${phone}, source: ${source}`);
    try {
      if (pool) {
        await pool.query("INSERT INTO leads (name, phone, age_group, location) VALUES ($1, $2, $3, $4)", [name, phone, age_group, location]);
        console.log('Lead saved to database');
      } else {
        console.log('Database not configured, skipping lead save');
      }
      
      const message = `
<b>🔔 Нова заявка на пробне заняття!</b>
<b>Джерело:</b> ${source || 'Головна'}
<b>Ім'я:</b> ${name}
<b>Телефон:</b> ${phone}
<b>Вікова група:</b> ${age_group}
<b>Локація:</b> ${location || 'Не вказано'}
      `;
      
      // Send notifications in background
      Promise.all([
        sendTelegramMessage(message),
        sendMetaEvent('Lead', { name, phone, event_id, source }, req)
      ]).catch(err => console.error('Background notification error:', err));

      res.json({ success: true });
    } catch (e) {
      console.error("Failed to save lead:", e);
      res.status(500).json({ error: "Failed to save lead" });
    }
  });

  // --- Scheduled Tasks (Telegram Notifications) ---

  // Weekly Attendance Report - Every Sunday at 20:00
  cron.schedule('0 20 * * 0', async () => {
    console.log('Running weekly attendance report...');
    try {
      if (!pool) return;
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const dateStr = oneWeekAgo.toISOString().split('T')[0];

      const result = await pool.query(`
        SELECT 
          p.name,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count
        FROM participants p
        LEFT JOIN attendance a ON p.id = a.participant_id AND a.date >= $1
        WHERE p.status = 'active'
        GROUP BY p.id, p.name
        ORDER BY present_count DESC
      `, [dateStr]);

      const participants = result.rows;
      const regular = participants.filter(p => parseInt(p.present_count) >= 2);
      const missing = participants.filter(p => parseInt(p.present_count) === 0);

      let report = `<b>📊 Звіт про відвідуваність за тиждень</b>\n\n`;
      
      report += `<b>✅ Регулярно ходять:</b>\n`;
      if (regular.length > 0) {
        regular.slice(0, 10).forEach(p => {
          report += `• ${p.name} (${p.present_count} зан.)\n`;
        });
      } else {
        report += `<i>Дані відсутні</i>\n`;
      }

      report += `\n<b>⚠️ Пропускають (0 занять):</b>\n`;
      if (missing.length > 0) {
        missing.slice(0, 15).forEach(p => {
          report += `• ${p.name}\n`;
        });
      } else {
        report += `<i>Всі відвідували заняття!</i>\n`;
      }

      await sendTelegramMessage(report);
      console.log('Weekly attendance report sent.');
    } catch (err) {
      console.error('Failed to send weekly report:', err);
    }
  });

  // Monthly Payment Reminder - Every 1st of the month at 09:00
  cron.schedule('0 9 1 * *', async () => {
    console.log('Running monthly payment reminder...');
    try {
      if (!pool) return;

      const result = await pool.query(`
        SELECT name, belt FROM participants 
        WHERE payment_status != 'paid' AND status = 'active'
      `);

      const debtors = result.rows;
      if (debtors.length === 0) return;

      let message = `<b>💳 Нагадування про оплату (до 5 числа)</b>\n\n`;
      message += `Нагадуємо про необхідність оплати за поточний місяць для наступних учнів:\n\n`;
      
      debtors.forEach(p => {
        message += `• ${p.name} (${p.belt || 'Білий'})\n`;
      });

      message += `\nБудь ласка, здійсніть оплату вчасно. Дякуємо!`;

      await sendTelegramMessage(message);
      console.log('Monthly payment reminder sent.');
    } catch (err) {
      console.error('Failed to send payment reminder:', err);
    }
  });

  // Daily Birthday Notification - Every day at 09:00
  cron.schedule('0 9 * * *', async () => {
    console.log('Checking for birthdays today...');
    try {
      if (!pool) return;

      const result = await pool.query(`
        SELECT p.name, g.name as group_name, p.age
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM p.birthday) = EXTRACT(DAY FROM CURRENT_DATE)
        AND p.status = 'active'
      `);

      const birthdays = result.rows;
      if (birthdays.length === 0) return;

      let message = `<b>🎂 Сьогодні День Народження!</b>\n\n`;
      birthdays.forEach(p => {
        message += `🎉 Вітаємо <b>${p.name}</b> з групи "${p.group_name || 'Без групи'}"! 🥳\n`;
      });

      await sendTelegramMessage(message);
      console.log('Birthday notifications sent.');
    } catch (err) {
      console.error('Failed to send birthday notifications:', err);
    }
  });

  // Startup Notification
  setTimeout(() => {
    sendTelegramMessage(`<b>🚀 Системне оновлення</b>\n\nСистема Black Bear успішно запущена та готова до роботи.\nВсі модулі сповіщень активовані.`);
  }, 5000);

  // --- End Scheduled Tasks ---

  app.delete("/api/leads/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM leads WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  app.put("/api/leads/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, phone, age_group, location, status } = req.body;
    try {
      await pool.query(
        "UPDATE leads SET name = $1, phone = $2, age_group = $3, location = $4, status = $5 WHERE id = $6",
        [name, phone, age_group, location, status, req.params.id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Caches for Optimization
  let initCache: any = null;
  let lastInitUpdate = Date.now();
  let contentCache: any = null;
  let lastCacheUpdate = Date.now();
  const imageCache = new Map<string, { contentType: string, buffer: Buffer, timestamp: number }>();
  const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache
  const IMAGE_CACHE_TTL = 60 * 60 * 1000; // 1 hour server-side cache

  const invalidateInitCache = () => {
    initCache = null;
    lastInitUpdate = Date.now();
    contentCache = null;
    lastCacheUpdate = Date.now();
    imageCache.clear();
  };

  // Image Serving Endpoints for Bandwidth Optimization
  app.get("/api/images/content/:key", async (req, res) => {
    if (!pool) return res.status(500).send("Database not configured");
    const cacheKey = `content_${req.params.key}`;
    const cached = imageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < IMAGE_CACHE_TTL)) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(cached.buffer);
    }

    try {
      const result = await pool.query("SELECT value FROM site_content WHERE key = $1", [req.params.key]);
      if (result.rows.length === 0 || !result.rows[0].value.startsWith('data:image/')) {
        return res.status(404).send("Image not found");
      }
      
      const base64Data = result.rows[0].value;
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).send("Invalid image format");
      }
      
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      
      // Update cache
      imageCache.set(cacheKey, { contentType, buffer, timestamp: Date.now() });
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
      res.send(buffer);
    } catch (e) {
      console.error(e);
      res.status(500).send("Internal server error");
    }
  });

  app.get("/api/images/coaches/:id", async (req, res) => {
    if (!pool) return res.status(500).send("Database not configured");
    const cacheKey = `coach_${req.params.id}`;
    const cached = imageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < IMAGE_CACHE_TTL)) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(cached.buffer);
    }

    try {
      const result = await pool.query("SELECT photo FROM coaches WHERE id = $1", [req.params.id]);
      if (result.rows.length === 0 || !result.rows[0].photo || !result.rows[0].photo.startsWith('data:image/')) {
        return res.status(404).send("Image not found");
      }
      
      const base64Data = result.rows[0].photo;
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).send("Invalid image format");
      }
      
      const contentType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      
      // Update cache
      imageCache.set(cacheKey, { contentType, buffer, timestamp: Date.now() });
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
      res.send(buffer);
    } catch (e) {
      console.error(e);
      res.status(500).send("Internal server error");
    }
  });

  // Combined Init Data for Optimization
  app.get("/api/init", async (req, res) => {
    const now = Date.now();
    
    // Serve from cache if available and not expired
    if (initCache && (now - lastInitUpdate < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes browser cache
      return res.json(initCache);
    }

    if (!pool) return res.json({ content: {}, coaches: [], locations: [], schedule: [] });
    
    try {
      const [contentRes, coachesRes, locationsRes, scheduleRes] = await Promise.all([
        pool.query(`
          SELECT key, 
                 CASE WHEN LEFT(value, 11) = 'data:image/' THEN 'IMAGE' ELSE 'TEXT' END as type,
                 CASE WHEN LEFT(value, 11) = 'data:image/' THEN NULL ELSE value END as value
          FROM site_content
        `),
        pool.query(`
          SELECT id, name, role, bio, achievements, order_index,
                 CASE WHEN LEFT(photo, 11) = 'data:image/' THEN 'IMAGE' ELSE 'TEXT' END as photo_type,
                 CASE WHEN LEFT(photo, 11) = 'data:image/' THEN NULL ELSE photo END as photo
          FROM coaches
          ORDER BY order_index ASC
        `),
        pool.query("SELECT * FROM locations"),
        pool.query(`
          SELECT s.*, c.name as coach_name, l.name as location_name 
          FROM schedule s
          LEFT JOIN coaches c ON s.coach_id = c.id
          LEFT JOIN locations l ON s.location_id = l.id
        `)
      ]);

      const content = contentRes.rows.reduce((acc, item) => {
        if (item.type === 'IMAGE') {
          acc[item.key] = `/api/images/content/${item.key}?v=${lastInitUpdate || now}`;
        } else {
          acc[item.key] = item.value;
        }
        return acc;
      }, {});

      const coaches = coachesRes.rows.map(coach => {
        const c = { ...coach };
        
        // One-time fix for Oleg Kramarenko if photo is missing or broken
        if (c.name === "Олег Крамаренко" && (!c.photo || c.photo.includes('unsplash.com/photo-1544367567-0f2fcb009e0b'))) {
          c.photo = "https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=800&auto=format&fit=crop";
        }

        if (c.photo_type === 'IMAGE') {
          c.photo = `/api/images/coaches/${c.id}?v=${lastInitUpdate}`;
        }
        delete c.photo_type;
        return c;
      });

      const data = {
        content,
        coaches,
        locations: locationsRes.rows,
        schedule: scheduleRes.rows
      };

      // Update caches
      initCache = data;
      lastInitUpdate = now;
      contentCache = content;
      lastCacheUpdate = now;

      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes browser cache
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch init data" });
    }
  });

  // Site Content
  app.get("/api/content", async (req, res) => {
    const now = Date.now();
    
    // Serve from cache if available and not expired
    if (contentCache && (now - lastCacheUpdate < CACHE_TTL)) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes browser cache
      return res.json(contentCache);
    }

    if (!pool) return res.json({});
    try {
      const result = await pool.query(`
        SELECT key, 
               CASE WHEN LEFT(value, 11) = 'data:image/' THEN 'IMAGE' ELSE 'TEXT' END as type,
               CASE WHEN LEFT(value, 11) = 'data:image/' THEN NULL ELSE value END as value
        FROM site_content
      `);
      const content = result.rows.reduce((acc, item) => {
        if (item.type === 'IMAGE') {
          acc[item.key] = `/api/images/content/${item.key}?v=${lastInitUpdate || now}`;
        } else {
          acc[item.key] = item.value;
        }
        return acc;
      }, {});
      
      // Update cache
      contentCache = content;
      lastCacheUpdate = now;
      
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(content);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json({});
      }
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/content", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const updates = req.body;
    try {
      for (const [key, value] of Object.entries(updates)) {
        await pool.query(
          'INSERT INTO site_content (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',
          [key, String(value)]
        );
      }
      // Invalidate cache
      invalidateInitCache();
      
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update content' });
    }
  });

  // Coaches
  app.get("/api/coaches", async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(`
        SELECT id, name, role, bio, achievements, order_index,
               CASE WHEN LEFT(photo, 11) = 'data:image/' THEN 'IMAGE' ELSE 'TEXT' END as photo_type,
               CASE WHEN LEFT(photo, 11) = 'data:image/' THEN NULL ELSE photo END as photo
        FROM coaches 
        ORDER BY order_index ASC
      `);
      res.json(result.rows.map((c: any) => {
        let parsedAchievements = [];
        try {
          parsedAchievements = typeof c.achievements === 'string' ? JSON.parse(c.achievements || '[]') : (c.achievements || []);
        } catch (err) {
          console.error('Failed to parse achievements for coach', c.id, err);
        }
        
        const coach = { ...c, achievements: parsedAchievements };
        
        // One-time fix for Oleg Kramarenko if photo is missing or broken
        if (coach.name === "Олег Крамаренко" && (!coach.photo || coach.photo.includes('unsplash.com/photo-1544367567-0f2fcb009e0b'))) {
          coach.photo = "https://images.unsplash.com/photo-1594381898411-846e7d193883?q=80&w=800&auto=format&fit=crop";
        }

        if (coach.photo_type === 'IMAGE') {
          coach.photo = `/api/images/coaches/${coach.id}?v=${lastInitUpdate}`;
        }
        delete coach.photo_type;
        return coach;
      }));
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      console.error('Error fetching coaches:', e);
      res.status(500).json({ error: "Failed to fetch coaches" });
    }
  });

  app.post("/api/coaches", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, role, bio, achievements, photo } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO coaches (name, role, bio, photo, achievements) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [name, role, bio, photo, JSON.stringify(achievements || [])]
      );
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create coach" });
    }
  });

  app.delete("/api/coaches/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM coaches WHERE id = $1", [req.params.id]);
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete coach" });
    }
  });

  app.post('/api/coaches/:id/photo', requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { photo } = req.body;
    try {
      await pool.query('UPDATE coaches SET photo = $1 WHERE id = $2', [photo, req.params.id]);
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update photo' });
    }
  });

  app.put('/api/coaches/:id', requireAuth, async (req, res) => {
    const { name, role, bio, achievements, photo } = req.body;
    try {
      let query = 'UPDATE coaches SET name = $1, role = $2, bio = $3, achievements = $4';
      let params = [name, role, bio, JSON.stringify(achievements || [])];
      
      // Only update photo if it's not a generated URL that points back to the base64 data
      // This prevents overwriting the base64 data with its own serving URL
      if (photo && !photo.startsWith('/api/images/coaches/')) {
        query += ', photo = $5 WHERE id = $6';
        params.push(photo, req.params.id);
      } else {
        query += ' WHERE id = $5';
        params.push(req.params.id);
      }
      
      await pool.query(query, params);
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      console.error('Failed to update coach', e);
      res.status(500).json({ error: 'Failed to update coach' });
    }
  });

  // Locations
  app.get("/api/locations", async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT * FROM locations ORDER BY order_index ASC");
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  app.post("/api/locations", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, address, map_link, order_index } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO locations (name, address, map_link, order_index) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, address, map_link, order_index || 0]
      );
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create location" });
    }
  });

  app.put("/api/locations/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, address, map_link, order_index } = req.body;
    try {
      await pool.query(
        "UPDATE locations SET name = $1, address = $2, map_link = $3, order_index = $4 WHERE id = $5",
        [name, address, map_link, order_index || 0, req.params.id]
      );
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM locations WHERE id = $1", [req.params.id]);
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Schedule
  app.get("/api/schedule", async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(`
        SELECT s.*, c.name as coach_name, l.name as location_name 
        FROM schedule s
        LEFT JOIN coaches c ON s.coach_id = c.id
        LEFT JOIN locations l ON s.location_id = l.id
        ORDER BY s.location_id, s.order_index ASC
      `);
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.get("/api/admin/schedule", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT s.*, c.name as coach_name, l.name as location_name 
        FROM schedule s
        LEFT JOIN coaches c ON s.coach_id = c.id
        LEFT JOIN locations l ON s.location_id = l.id
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        query += " WHERE s.coach_id = $1";
        params.push(user.coach_id);
      }
      query += " ORDER BY s.location_id, s.order_index ASC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedule", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { location_id, coach_id, day_of_week, start_time, end_time, group_name, price, order_index } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO schedule (location_id, coach_id, day_of_week, start_time, end_time, group_name, price, order_index) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [parseInt(location_id), coach_id ? parseInt(coach_id) : null, day_of_week, start_time, end_time, group_name, price, order_index || 0]
      );
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create schedule entry" });
    }
  });

  app.put("/api/schedule/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { location_id, coach_id, day_of_week, start_time, end_time, group_name, price, order_index } = req.body;
    try {
      await pool.query(
        "UPDATE schedule SET location_id = $1, coach_id = $2, day_of_week = $3, start_time = $4, end_time = $5, group_name = $6, price = $7, order_index = $8 WHERE id = $9",
        [parseInt(location_id), coach_id ? parseInt(coach_id) : null, day_of_week, start_time, end_time, group_name, price, order_index || 0, req.params.id]
      );
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to update schedule entry" });
    }
  });

  app.delete("/api/schedule/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM schedule WHERE id = $1", [req.params.id]);
      // Invalidate cache
      invalidateInitCache();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete schedule entry" });
    }
  });

  // Auth
  const loginHandler = async (req: express.Request, res: express.Response) => {
    const login = (req.body.login || '').trim();
    const password = (req.body.password || '').trim();
    
    if (!login || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const expectedLogin = (process.env.ADMIN_LOGIN || 'ihorkot12').trim();
    const expectedPassword = (process.env.ADMIN_PASSWORD || '4756500').trim();
    
    console.log(`Login attempt for: ${login}`);
    
    // Check hardcoded admin (fallback)
    if (login === expectedLogin && password === expectedPassword) {
      console.log('Login successful (Admin - Hardcoded)');
      return res.json({ success: true, token: ADMIN_TOKEN, role: 'admin', name: 'Ігор Котляревський' });
    }

    if (!pool) return res.status(401).json({ error: 'Invalid credentials' });

    try {
      // Check admin_users table
      const adminUser = await pool.query("SELECT * FROM admin_users WHERE login = $1", [login]);
      if (adminUser.rows.length > 0) {
        const user = adminUser.rows[0];
        
        let isMatch = false;
        try {
          isMatch = await bcrypt.compare(password, user.password);
        } catch (e) {
          isMatch = password === user.password;
        }

        if (isMatch) {
          console.log(`Login successful (${user.role})`);
          const token = `${user.id}-${user.role}`;
          return res.json({ success: true, token, role: user.role, name: user.name });
        }
      }

      // Check if it's a parent login
      const parentUser = await pool.query("SELECT id, name, parent_password FROM participants WHERE parent_login = $1", [login]);
      if (parentUser.rows.length > 0) {
        const user = parentUser.rows[0];
        
        let isMatch = false;
        try {
          isMatch = await bcrypt.compare(password, user.parent_password);
        } catch (e) {
          isMatch = password === user.parent_password;
        }

        if (isMatch) {
          console.log('Login successful (Parent)');
          (req.session as any).participantId = user.id;
          return res.json({ success: true, role: 'parent', name: user.name });
        }
      }

      console.log('Login failed: Invalid credentials');
      res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Auth error' });
    }
  };

  app.post('/api/login', loginHandler);
  app.post('/api/auth/login', loginHandler);

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/check-auth', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({ isAdmin: true, role: user?.role || 'admin', name: user?.name });
  });

  // Admin Users Management
  app.get("/api/admin/users", requireAuth, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      const result = await pool.query("SELECT id, login, role, name, coach_id FROM admin_users ORDER BY id ASC");
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch admin users" });
    }
  });

  app.post("/api/admin/users", requireAuth, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { login, password, role, name, coach_id } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "INSERT INTO admin_users (login, password, role, name, coach_id) VALUES ($1, $2, $3, $4, $5)",
        [login, hashedPassword, role || 'coach', name, coach_id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to create admin user" });
    }
  });

  app.put("/api/admin/users/:id", requireAuth, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    const { login, password, role, name, coach_id } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          "UPDATE admin_users SET login = $1, password = $2, role = $3, name = $4, coach_id = $5 WHERE id = $6",
          [login, hashedPassword, role, name, coach_id, req.params.id]
        );
      } else {
        await pool.query(
          "UPDATE admin_users SET login = $1, role = $2, name = $3, coach_id = $4 WHERE id = $5",
          [login, role, name, coach_id, req.params.id]
        );
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update admin user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, async (req, res) => {
    if ((req as any).user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
      await pool.query("DELETE FROM admin_users WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete admin user" });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'New password required' });
    
    // In this environment, we use process.env for the password.
    // However, for a "real" app we'd update a database.
    // Since we can't update process.env permanently, we'll just mock success
    // or tell the user how to do it.
    console.log(`Password change requested to: ${newPassword}`);
    res.json({ success: true, message: 'Password change simulated. Please update ADMIN_PASSWORD in your environment variables for a permanent change.' });
  });

  // Participants
  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/participants/import", requireAuth, upload.single('file'), async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    
    let data: any[] = [];
    const { sheetUrl, group_id } = req.body;

    try {
      if (req.file) {
        // Handle file upload
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = xlsx.utils.sheet_to_json(worksheet);
      } else if (sheetUrl) {
        // Handle Google Sheets URL
        let fetchUrl = sheetUrl;
        if (sheetUrl.includes('docs.google.com/spreadsheets')) {
          // Try to convert to CSV export URL if it's a standard sharing link
          const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match) {
            fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
          }
        }
        
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error('Failed to fetch Google Sheet');
        const buffer = await response.arrayBuffer();
        const workbook = xlsx.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        data = xlsx.utils.sheet_to_json(worksheet);
      } else {
        return res.status(400).json({ error: "No file or URL provided" });
      }

      if (data.length === 0) {
        return res.status(400).json({ error: "No data found in file or URL" });
      }

      // Map data to database fields
      // Expected columns: "Name" or "Ім'я", "Age" or "Вік", "Login" or "Логін", "Password" or "Пароль", "Birthday" or "Дата народження"
      const participantsToInsert = data.map(row => ({
        name: row["Name"] || row["Ім'я"] || row["ПІБ"] || row["ПІБ дитини"] || row["name"] || row["ім'я"] || "",
        age: parseInt(row["Age"] || row["Вік"] || row["age"] || row["вік"] || "0"),
        birthday: row["Birthday"] || row["Дата народження"] || row["birthday"] || row["дата народження"] || null,
        parent_login: row["Login"] || row["Логін"] || row["Логін (англійською)"] || row["login"] || row["логін"] || `user_${Math.random().toString(36).substring(2, 7)}`,
        parent_password: row["Password"] || row["Пароль"] || row["Пароль (англійською)"] || row["password"] || row["пароль"] || Math.random().toString(36).substring(2, 10),
        group_id: group_id || null,
        payment_status: row["Payment"] || row["Оплата"] || 'unpaid',
        status: row["Status"] || row["Статус"] || 'active'
      })).filter(p => p.name);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const p of participantsToInsert) {
          // Handle birthday format if it's a string from Excel/CSV
          let formattedBirthday = null;
          if (p.birthday) {
            try {
              const d = new Date(p.birthday);
              if (!isNaN(d.getTime())) {
                formattedBirthday = d.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn(`Invalid birthday format for ${p.name}: ${p.birthday}`);
            }
          }

          await client.query(
            "INSERT INTO participants (name, age, birthday, group_id, parent_login, parent_password, payment_status, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (parent_login) DO NOTHING",
            [p.name, p.age, formattedBirthday, p.group_id, p.parent_login, p.parent_password, p.payment_status, p.status]
          );
        }
        await client.query('COMMIT');
        res.json({ success: true, count: participantsToInsert.length });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.error("Import failed:", e);
      res.status(500).json({ error: `Failed to import participants: ${e.message}` });
    }
  });

  app.get("/api/participants", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    const search = req.query.search as string;
    try {
      let query = `
        SELECT p.*, g.name as group_name 
        FROM participants p 
        LEFT JOIN groups g ON p.group_id = g.id 
      `;
      let params: any[] = [];
      let whereClauses: string[] = [];

      if (user.role === 'coach' && user.coach_id) {
        whereClauses.push(`g.coach_id = $${params.length + 1}`);
        params.push(user.coach_id);
      }

      if (search) {
        whereClauses.push(`p.name ILIKE $${params.length + 1}`);
        params.push(`%${search}%`);
      }

      if (whereClauses.length > 0) {
        query += " WHERE " + whereClauses.join(" AND ");
      }

      query += " ORDER BY p.name ASC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  app.post("/api/participants", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, age, birthday, group_id, parent_login, parent_password, payment_status, status } = req.body;
    
    // Auto-generate credentials if missing
    const finalLogin = parent_login || `parent_${Math.random().toString(36).substring(2, 8)}`;
    const rawPassword = parent_password || Math.random().toString(36).substring(2, 10);
    
    try {
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      await pool.query(
        "INSERT INTO participants (name, age, birthday, group_id, parent_login, parent_password, payment_status, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [name, age, birthday || null, group_id || null, finalLogin, hashedPassword, payment_status || 'unpaid', status || 'active']
      );
      res.json({ success: true, parent_login: finalLogin, parent_password: rawPassword });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  app.put("/api/participants/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, age, birthday, group_id, parent_login, parent_password, payment_status, status } = req.body;
    try {
      if (parent_password && !parent_password.startsWith('$2a$')) {
        const hashedPassword = await bcrypt.hash(parent_password, 10);
        await pool.query(
          "UPDATE participants SET name = $1, age = $2, birthday = $3, group_id = $4, parent_login = $5, parent_password = $6, payment_status = $7, status = $8 WHERE id = $9",
          [name, age, birthday || null, group_id || null, parent_login, hashedPassword, payment_status || 'unpaid', status || 'active', req.params.id]
        );
      } else {
        await pool.query(
          "UPDATE participants SET name = $1, age = $2, birthday = $3, group_id = $4, parent_login = $5, payment_status = $6, status = $7 WHERE id = $8",
          [name, age, birthday || null, group_id || null, parent_login, payment_status || 'unpaid', status || 'active', req.params.id]
        );
      }
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to update participant" });
    }
  });

  app.delete("/api/participants/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM participants WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete participant" });
    }
  });

  app.put("/api/participants/:id/rank", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { belt, rank_points } = req.body;
    try {
      await pool.query(
        "UPDATE participants SET belt = $1, rank_points = $2 WHERE id = $3",
        [belt, rank_points, req.params.id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update rank" });
    }
  });

  // Badges (Achievements)
  app.get("/api/badges", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(`
        SELECT b.*, p.name as participant_name 
        FROM badges b 
        JOIN participants p ON b.participant_id = p.id 
        ORDER BY b.date DESC
      `);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.get("/api/participants/:id/badges", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT * FROM badges WHERE participant_id = $1 ORDER BY date DESC", [req.params.id]);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch participant badges" });
    }
  });

  app.post("/api/badges", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participant_id, type, date } = req.body;
    const badgeDate = date || new Date();
    try {
      await pool.query("BEGIN");
      const result = await pool.query(
        "INSERT INTO badges (participant_id, type, date) VALUES ($1, $2, $3) RETURNING id",
        [participant_id, type, badgeDate]
      );
      const badgeId = result.rows[0].id;

      // Increment rank points by 10 for a badge
      await pool.query(
        "INSERT INTO points_log (participant_id, points, reason, date, reference_id) VALUES ($1, $2, $3, $4, $5)",
        [participant_id, 10, 'badge', badgeDate, `badge_${badgeId}`]
      );
      await pool.query("UPDATE participants SET rank_points = rank_points + 10 WHERE id = $1", [participant_id]);
      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to create badge" });
    }
  });

  app.delete("/api/badges/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("BEGIN");
      const badgeRes = await pool.query("SELECT participant_id FROM badges WHERE id = $1", [req.params.id]);
      if (badgeRes.rows.length > 0) {
        const participantId = badgeRes.rows[0].participant_id;
        await pool.query("DELETE FROM badges WHERE id = $1", [req.params.id]);
        
        // Find points from log to decrement correctly
        const logRes = await pool.query("SELECT points FROM points_log WHERE reference_id = $1", [`badge_${req.params.id}`]);
        const pointsToSubtract = logRes.rows.length > 0 ? logRes.rows[0].points : 10;

        await pool.query("DELETE FROM points_log WHERE reference_id = $1", [`badge_${req.params.id}`]);
        await pool.query("UPDATE participants SET rank_points = GREATEST(0, rank_points - $1) WHERE id = $2", [pointsToSubtract, participantId]);
      }
      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to delete badge" });
    }
  });

  // Competitions
  app.get("/api/competitions", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(`
        SELECT c.*, p.name as participant_name 
        FROM competitions c 
        JOIN participants p ON c.participant_id = p.id 
        ORDER BY c.date DESC
      `);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch competitions" });
    }
  });

  app.get("/api/participants/:id/competitions", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT * FROM competitions WHERE participant_id = $1 ORDER BY date DESC", [req.params.id]);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch participant competitions" });
    }
  });

  app.post("/api/competitions", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participant_id, name, result, date, type = 'competition' } = req.body;
    try {
      await pool.query("BEGIN");
      const insertRes = await pool.query(
        "INSERT INTO competitions (participant_id, name, type, result, date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [participant_id, name, type, result, date]
      );
      const compId = insertRes.rows[0].id;
      
      // Points logic
      let points = 5; // Default participation
      
      if (type === 'competition') {
        const normalizedResult = result?.toLowerCase()?.trim() || "";
        if (normalizedResult.startsWith('1') || normalizedResult.includes('1 місце')) points = 15;
        else if (normalizedResult.startsWith('2') || normalizedResult.includes('2 місце')) points = 10;
        else if (normalizedResult.startsWith('3') || normalizedResult.includes('3 місце')) points = 7;
      } else if (type === 'certification') {
        points = 20; // Certification is high value
      } else if (type === 'seminar') {
        points = 10;
      } else if (type === 'club_event') {
        points = 5;
      }

      await pool.query(
        "INSERT INTO points_log (participant_id, points, reason, date, reference_id) VALUES ($1, $2, $3, $4, $5)",
        [participant_id, points, `${type}_${result || name}`, date, `comp_${compId}`]
      );

      await pool.query("UPDATE participants SET rank_points = rank_points + $1 WHERE id = $2", [points, participant_id]);
      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to create entry" });
    }
  });

  app.delete("/api/competitions/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("BEGIN");
      const compRes = await pool.query("SELECT participant_id FROM competitions WHERE id = $1", [req.params.id]);
      if (compRes.rows.length > 0) {
        const participantId = compRes.rows[0].participant_id;
        
        // Find points from log to decrement correctly
        const logRes = await pool.query("SELECT points FROM points_log WHERE reference_id = $1", [`comp_${req.params.id}`]);
        const pointsToSubtract = logRes.rows.length > 0 ? logRes.rows[0].points : 5;

        await pool.query("DELETE FROM competitions WHERE id = $1", [req.params.id]);
        await pool.query("DELETE FROM points_log WHERE reference_id = $1", [`comp_${req.params.id}`]);
        await pool.query("UPDATE participants SET rank_points = GREATEST(0, rank_points - $1) WHERE id = $2", [pointsToSubtract, participantId]);
      }
      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to delete competition entry" });
    }
  });

  // Groups
  app.get("/api/groups", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = "SELECT * FROM groups";
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        query += " WHERE coach_id = $1";
        params.push(user.coach_id);
      }
      query += " ORDER BY order_index ASC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/groups", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, location_id, coach_id, order_index } = req.body;
    const user = (req as any).user;
    const finalCoachId = user.role === 'coach' ? user.coach_id : coach_id;
    
    try {
      const result = await pool.query(
        "INSERT INTO groups (name, location_id, coach_id, order_index) VALUES ($1, $2, $3, $4) RETURNING id",
        [name, location_id || null, finalCoachId || null, order_index || 0]
      );
      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.put("/api/groups/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { name, location_id, coach_id, order_index } = req.body;
    const user = (req as any).user;
    
    try {
      if (user.role === 'coach') {
        const check = await pool.query("SELECT coach_id FROM groups WHERE id = $1", [req.params.id]);
        if (check.rows.length === 0 || check.rows[0].coach_id !== user.coach_id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      await pool.query(
        "UPDATE groups SET name = $1, location_id = $2, coach_id = $3, order_index = $4 WHERE id = $5",
        [name, location_id || null, coach_id || null, order_index || 0, req.params.id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update group" });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    try {
      if (user.role === 'coach') {
        const check = await pool.query("SELECT coach_id FROM groups WHERE id = $1", [req.params.id]);
        if (check.rows.length === 0 || check.rows[0].coach_id !== user.coach_id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      await pool.query("DELETE FROM groups WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    try {
      let groupDistQuery = `
        SELECT g.name as group_name, COUNT(p.id) as count
        FROM groups g
        LEFT JOIN participants p ON g.id = p.group_id
      `;
      let groupDistParams: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        groupDistQuery += " WHERE g.coach_id = $1";
        groupDistParams.push(user.coach_id);
      }
      groupDistQuery += " GROUP BY g.name";

      let totalsQuery = "";
      let totalsParams: any[] = [];
      
      if (user.role === 'coach' && user.coach_id) {
        totalsQuery = `
          SELECT 
            0 as total_leads,
            0 as new_leads,
            1 as total_coaches,
            (SELECT COUNT(*) FROM groups WHERE coach_id = $1) as total_locations,
            (SELECT COUNT(*) FROM participants p JOIN groups g ON p.group_id = g.id WHERE g.coach_id = $1) as total_participants,
            (SELECT COUNT(*) FROM participants p JOIN groups g ON p.group_id = g.id WHERE p.payment_status = 'unpaid' AND g.coach_id = $1) as unpaid_participants
        `;
        totalsParams.push(user.coach_id);
      } else {
        totalsQuery = `
          SELECT 
            (SELECT COUNT(*) FROM leads) as total_leads,
            (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
            (SELECT COUNT(*) FROM coaches) as total_coaches,
            (SELECT COUNT(*) FROM locations) as total_locations,
            (SELECT COUNT(*) FROM participants) as total_participants,
            (SELECT COUNT(*) FROM participants WHERE payment_status = 'unpaid') as unpaid_participants
        `;
      }

      const [leadsByDay, groupDistribution, recentLeads, totals] = await Promise.all([
        pool.query(`
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM leads 
          WHERE created_at > CURRENT_DATE - INTERVAL '14 days'
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `),
        pool.query(groupDistQuery, groupDistParams),
        pool.query(`
          SELECT * FROM leads 
          ORDER BY created_at DESC 
          LIMIT 5
        `),
        pool.query(totalsQuery, totalsParams)
      ]);

      res.json({
        leadsOverTime: user.role === 'admin' ? leadsByDay.rows : [],
        groupDistribution: groupDistribution.rows,
        recentLeads: user.role === 'admin' ? recentLeads.rows : [],
        totals: totals.rows[0]
      });
    } catch (e) {
      console.error('Dashboard stats error:', e);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    if (!pool) return res.json({});
    try {
      const result = await pool.query("SELECT * FROM settings");
      const settings: any = {};
      result.rows.forEach(row => {
        settings[row.key] = row.value;
      });
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const settings = req.body;
    try {
      for (const [key, value] of Object.entries(settings)) {
        await pool.query(
          "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
          [key, String(value)]
        );
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Attendance
  app.get("/api/attendance/:date", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT a.* 
        FROM attendance a
        JOIN participants p ON a.participant_id = p.id
        JOIN groups g ON p.group_id = g.id
        WHERE a.date = $1
      `;
      let params: any[] = [req.params.date];
      if (user.role === 'coach' && user.coach_id) {
        query += " AND g.coach_id = $2";
        params.push(user.coach_id);
      }
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      if (e?.message?.includes('quota')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participant_id, date, status } = req.body;
    try {
      await pool.query("BEGIN");
      
      // Check if attendance already exists to avoid double points
      const existing = await pool.query(
        "SELECT status FROM attendance WHERE participant_id = $1 AND date = $2",
        [participant_id, date]
      );

      await pool.query(
        "INSERT INTO attendance (participant_id, date, status) VALUES ($1, $2, $3) ON CONFLICT(participant_id, date) DO UPDATE SET status=EXCLUDED.status",
        [participant_id, date, status]
      );

      // Points logic: +1 for present, -1 if changed from present to absent
      if (status === 'present' && (!existing.rows[0] || existing.rows[0].status !== 'present')) {
        await pool.query(
          "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
          [participant_id, 1, 'attendance', date]
        );
        await pool.query("UPDATE participants SET rank_points = rank_points + 1 WHERE id = $1", [participant_id]);
      } else if (status === 'absent' && existing.rows[0] && existing.rows[0].status === 'present') {
        await pool.query(
          "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
          [participant_id, -1, 'attendance_removal', date]
        );
        await pool.query("UPDATE participants SET rank_points = GREATEST(0, rank_points - 1) WHERE id = $1", [participant_id]);
      }

      await pool.query("COMMIT");
      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  // Ratings and Birthdays
  app.get("/api/ratings", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const { period, global } = req.query; // 'month', 'season', 'year', global: 'true'
    const user = (req as any).user;
    
    try {
      let dateFilter = "";
      if (period === 'month') {
        dateFilter = "AND pl.date >= date_trunc('month', CURRENT_DATE)";
      } else if (period === 'year') {
        dateFilter = "AND pl.date >= date_trunc('year', CURRENT_DATE)";
      } else if (period === 'season') {
        dateFilter = `AND pl.date >= CASE 
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) = 12 THEN date_trunc('year', CURRENT_DATE) + INTERVAL '11 months'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (1, 2) THEN date_trunc('year', CURRENT_DATE) - INTERVAL '1 month'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN date_trunc('year', CURRENT_DATE) + INTERVAL '2 months'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN date_trunc('year', CURRENT_DATE) + INTERVAL '5 months'
          ELSE date_trunc('year', CURRENT_DATE) + INTERVAL '8 months'
        END`;
      }

      let query = `
        SELECT p.id, p.name, SUM(pl.points) as total_points, g.name as group_name, l.name as location_name
        FROM participants p
        JOIN points_log pl ON p.id = pl.participant_id
        LEFT JOIN groups g ON p.group_id = g.id
        LEFT JOIN locations l ON g.location_id = l.id
        WHERE 1=1 ${dateFilter}
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id && global !== 'true') {
        query += " AND g.coach_id = $1";
        params.push(user.coach_id);
      }
      query += " GROUP BY p.id, p.name, g.name, l.name ORDER BY total_points DESC LIMIT 20";
      
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch ratings" });
    }
  });

  app.get("/api/birthdays", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT p.*, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM p.birthday) = EXTRACT(DAY FROM CURRENT_DATE)
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        query += " AND g.coach_id = $1";
        params.push(user.coach_id);
      }
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch birthdays" });
    }
  });

  // Profile (for parents)
  app.get("/api/profile", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const participantId = (req.session as any).participantId;
    if (!participantId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const pResult = await pool.query(`
        SELECT p.*, g.name as group_name 
        FROM participants p 
        LEFT JOIN groups g ON p.group_id = g.id 
        WHERE p.id = $1
      `, [participantId]);
      
      if (pResult.rows.length === 0) return res.status(404).json({ error: "Not found" });

      const aResult = await pool.query("SELECT * FROM attendance WHERE participant_id = $1 ORDER BY date DESC", [participantId]);
      const bResult = await pool.query("SELECT * FROM badges WHERE participant_id = $1 ORDER BY date DESC", [participantId]);
      const cResult = await pool.query("SELECT * FROM competitions WHERE participant_id = $1 ORDER BY date DESC", [participantId]);

      res.json({
        participant: pResult.rows[0],
        attendance: aResult.rows,
        badges: bResult.rows,
        competitions: cResult.rows
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Image Upload and Serving
  app.post("/api/upload", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { image } = req.body;
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    try {
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      
      const contentType = matches[1];
      const result = await pool.query(
        "INSERT INTO images (data, content_type) VALUES ($1, $2) RETURNING id",
        [image, contentType]
      );
      
      const id = result.rows[0].id;
      res.json({ url: `/api/images/${id}` });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  app.get("/api/images/:id", async (req, res) => {
    if (!pool) return res.status(500).send("Database not configured");
    const id = req.params.id;
    const cacheKey = `img_${id}`;
    const cached = imageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < IMAGE_CACHE_TTL)) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(cached.buffer);
    }

    try {
      const result = await pool.query("SELECT data, content_type FROM images WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return res.status(404).send("Image not found");
      }
      
      const { data, content_type } = result.rows[0];
      const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).send("Invalid image format in database");
      }
      
      const buffer = Buffer.from(matches[2], 'base64');
      
      // Update cache
      imageCache.set(cacheKey, { contentType: content_type, buffer, timestamp: Date.now() });
      
      res.setHeader('Content-Type', content_type);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch (e) {
      console.error(e);
      res.status(500).send("Internal server error");
    }
  });

    // Delete all leads
    app.delete('/api/leads/delete-all', requireAuth, async (req, res) => {
      try {
        await pool.query('DELETE FROM leads');
        res.json({ message: 'All leads deleted' });
      } catch (e) {
        console.error('Delete all leads failed', e);
        res.status(500).json({ error: 'Server error' });
      }
    });

    // Parent Portal Endpoints
    app.get("/api/parent/me", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const result = await pool.query(`
          SELECT p.*, g.name as group_name 
          FROM participants p 
          LEFT JOIN groups g ON p.group_id = g.id 
          WHERE p.id = $1
        `, [participantId]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
        
        const participant = result.rows[0];
        delete participant.parent_password; // Security
        res.json(participant);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch parent data" });
      }
    });

    app.get("/api/parent/attendance", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const result = await pool.query("SELECT * FROM attendance WHERE participant_id = $1 ORDER BY date DESC", [participantId]);
        res.json(result.rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch attendance" });
      }
    });

    app.get("/api/parent/badges", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const result = await pool.query("SELECT * FROM badges WHERE participant_id = $1 ORDER BY date DESC", [participantId]);
        res.json(result.rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch badges" });
      }
    });

    app.get("/api/parent/schedule", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const pRes = await pool.query("SELECT group_id FROM participants WHERE id = $1", [participantId]);
        if (pRes.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
        
        const groupId = pRes.rows[0].group_id;
        if (!groupId) return res.json([]);

        const gRes = await pool.query("SELECT name FROM groups WHERE id = $1", [groupId]);
        const groupName = gRes.rows[0].name;

        const sRes = await pool.query(`
          SELECT s.*, c.name as coach_name, l.name as location_name 
          FROM schedule s 
          LEFT JOIN coaches c ON s.coach_id = c.id 
          LEFT JOIN locations l ON s.location_id = l.id 
          WHERE s.group_name = $1
          ORDER BY s.order_index ASC
        `, [groupName]);
        
        res.json(sRes.rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch schedule" });
      }
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
    app.use(express.static(path.join(__dirname, "..", "dist"), {
      maxAge: '1d',
      immutable: true
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "..", "dist", "index.html"));
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

