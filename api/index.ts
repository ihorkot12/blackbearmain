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
import fetch from 'node-fetch';
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
        telegram_chat_id TEXT,
        order_index INTEGER DEFAULT 0
      );

      ALTER TABLE coaches ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

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
        order_index INTEGER DEFAULT 0,
        capacity INTEGER DEFAULT 20
      );
      
      ALTER TABLE groups ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 20;
    `);

    // Ensure parent_login is not unique to allow multiple children per parent
    try {
      await client.query("ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_parent_login_key");
      // Normalize existing parent_login values (remove spaces, dashes, etc.)
      await client.query("UPDATE participants SET parent_login = REGEXP_REPLACE(parent_login, '[^\\d+]', '', 'g') WHERE parent_login IS NOT NULL AND parent_login ~ '[^\\d+]'");
      
      // Ensure parent_login is set for all participants who have a phone
      await client.query(`
        UPDATE participants 
        SET parent_login = REGEXP_REPLACE(COALESCE(parent_phone, phone), '[^\\d]', '', 'g') 
        WHERE (parent_login IS NULL OR parent_login = '') AND (parent_phone IS NOT NULL OR phone IS NOT NULL)
      `);
    } catch (e) {
      console.log("Note: Could not update participants table constraints or data.", e);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        birthday DATE,
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        parent_login TEXT,
        parent_password TEXT,
        belt TEXT DEFAULT 'Білий',
        rank_points INTEGER DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parent_name TEXT,
        phone TEXT,
        parent_phone TEXT,
        telegram_chat_id TEXT,
        exam_readiness TEXT DEFAULT 'not_started',
        skill_checklist JSONB DEFAULT '[]',
        streak INTEGER DEFAULT 0,
        last_attendance_date DATE,
        achievements_text TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure achievements_text exists
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='achievements_text') THEN
          ALTER TABLE participants ADD COLUMN achievements_text TEXT;
        END IF;
      END $$;

      -- Ensure updated_at exists
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='updated_at') THEN
          ALTER TABLE participants ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        type TEXT NOT NULL, -- 'absence', 'payment', 'event', 'achievement'
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE participants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS exam_readiness TEXT DEFAULT 'not_started';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS skill_checklist JSONB DEFAULT '[]';
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_attendance_date DATE;
      
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER, -- admin or coach id
        user_role TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id INTEGER,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS coach_notes (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        visibility TEXT DEFAULT 'private', -- 'private' (coach only), 'parent' (coach + parent), 'public' (all)
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status TEXT NOT NULL, -- 'present', 'absent', 'late', 'excused'
        notes TEXT,
        coach_id INTEGER, -- who marked it
        UNIQUE(participant_id, date)
      );

      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS coach_id INTEGER;

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

      CREATE TABLE IF NOT EXISTS instagram_accounts (
        id SERIAL PRIMARY KEY,
        admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
        username TEXT,
        access_token TEXT NOT NULL,
        instagram_business_account_id TEXT,
        facebook_page_id TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE;

      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        data TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL, -- 'parent', 'coach', 'admin'
        sender_id INTEGER, -- admin_user_id or coach_id (null if parent)
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
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

      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        month INTEGER,
        year INTEGER,
        type TEXT DEFAULT 'subscription', -- 'subscription', 'exam', 'equipment', 'other'
        method TEXT DEFAULT 'cash', -- 'cash', 'card', 'online'
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        author_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS smm_posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        audience TEXT,
        goal TEXT,
        pain TEXT,
        format TEXT,
        source_signal TEXT,
        score INTEGER,
        reason TEXT,
        content JSONB, -- { hook, script, caption, cta, prompt, visual_execution, on_screen_text, cover_idea }
        scoring JSONB, -- { relevance, viral, difficulty, brand, total }
        status TEXT DEFAULT 'generated', -- 'generated', 'selected', 'filmed', 'published', 'archived'
        metrics JSONB DEFAULT '{}', -- { likes, comments, saves, shares, engagement_rate }
        result_tag TEXT, -- 'worked', 'average', 'failed'
        notes TEXT,
        published_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS smm_strategy (
        id SERIAL PRIMARY KEY,
        week_start DATE UNIQUE,
        strategy_text TEXT,
        patterns JSONB,
        blind_spots JSONB,
        swot JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS smm_pains (
        id SERIAL PRIMARY KEY,
        audience TEXT NOT NULL,
        pain_name TEXT NOT NULL,
        source_type TEXT, -- 'manual', 'ai_analysis'
        signal_strength INTEGER DEFAULT 50,
        trend_direction TEXT DEFAULT 'stable', -- 'rising', 'stable', 'falling'
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS smm_account_analysis (
        id SERIAL PRIMARY KEY,
        analysis_date DATE DEFAULT CURRENT_DATE,
        strengths JSONB,
        weaknesses JSONB,
        missing_content JSONB,
        adjacent_opportunities JSONB,
        recommendations JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS smm_account_metrics (
        id SERIAL PRIMARY KEY,
        followers INTEGER NOT NULL,
        following INTEGER,
        posts_count INTEGER,
        engagement_rate DECIMAL(5, 2),
        reach INTEGER,
        impressions INTEGER,
        date DATE DEFAULT CURRENT_DATE UNIQUE,
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
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS parent_name TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone TEXT;

      ALTER TABLE leads ADD COLUMN IF NOT EXISTS value DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_participant_id INTEGER REFERENCES participants(id) ON DELETE SET NULL;
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
  app.set('trust proxy', 1);

  const normalizePhone = (phone: string) => {
    if (!phone) return phone;
    // Remove all non-digits except +
    return phone.replace(/[^\d+]/g, '');
  };

  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
      secure: true, 
      httpOnly: true, 
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
      const [id, role] = token.split('-');
      try {
        if (role === 'parent') {
          const result = await pool.query("SELECT id, name, 'parent' as role FROM participants WHERE id::text = $1", [id]);
          if (result.rows.length > 0) {
            (req as any).user = result.rows[0];
            return next();
          }
        } else {
          const result = await pool.query("SELECT * FROM admin_users WHERE id::text = $1", [id]);
          if (result.rows.length > 0) {
            (req as any).user = result.rows[0];
            return next();
          }
        }
      } catch (e) {
        console.error('Auth error:', e);
      }
    }

    // Also check session for parent
    if ((req.session as any).participantId) {
      (req as any).user = { 
        id: (req.session as any).participantId, 
        role: 'parent', 
        name: (req.session as any).userName 
      };
      return next();
    }

    console.log(`Auth failed. Received: ${authHeader?.substring(0, 15)}...`);
    res.status(401).json({ error: 'Unauthorized' });
  };

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    requireAuth(req, res, () => {
      if ((req as any).user?.role === 'admin') {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
      }
    });
  };

  // Instagram OAuth Routes
  app.get('/api/auth/instagram/url', (req, res) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: "Instagram Client ID not configured" });

    const { action } = req.query; // 'login' or 'connect'
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;
    
    // Scopes needed for Business Account insights
    const scopes = [
      'instagram_basic',
      'instagram_manage_insights',
      'pages_read_engagement',
      'pages_show_list',
      'business_management'
    ].join(',');

    const state = action === 'login' ? 'login' : 'connect';
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;
    
    res.json({ url: authUrl });
  });

  app.get('/api/auth/instagram/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("No code provided");

    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;
    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/instagram/callback`;

    try {
      // 1. Exchange code for access token
      const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`);
      const tokenData: any = await tokenRes.json();

      if (tokenData.error) throw new Error(tokenData.error.message);

      const accessToken = tokenData.access_token;

      // 2. Get User's Pages to find linked Instagram Business Account
      const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`);
      const pagesData: any = await pagesRes.json();

      let instagramBusinessAccountId = null;
      let facebookPageId = null;
      let username = 'Connected Account';

      if (pagesData.data && pagesData.data.length > 0) {
        for (const page of pagesData.data) {
          const igRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${accessToken}`);
          const igData: any = await igRes.json();
          
          if (igData.instagram_business_account) {
            instagramBusinessAccountId = igData.instagram_business_account.id;
            facebookPageId = page.id;
            
            const userRes = await fetch(`https://graph.facebook.com/v19.0/${instagramBusinessAccountId}?fields=username&access_token=${accessToken}`);
            const userData: any = await userRes.json();
            username = userData.username || username;
            break;
          }
        }
      }

      if (!instagramBusinessAccountId) {
        return res.send(`
          <html>
            <body>
              <script>
                alert("No Instagram Business Account linked to your Facebook Pages found.");
                window.close();
              </script>
            </body>
          </html>
        `);
      }

      // 3. Handle Login vs Connect
      if (state === 'login') {
        const result = await pool.query(
          "SELECT admin_users.* FROM admin_users JOIN instagram_accounts ON admin_users.id = instagram_accounts.admin_user_id WHERE instagram_accounts.instagram_business_account_id = $1",
          [instagramBusinessAccountId]
        );

        if (result.rows.length === 0) {
          return res.send(`
            <html>
              <body>
                <script>
                  alert("Цей Instagram акаунт не прив'язаний до жодного адміна.");
                  window.close();
                </script>
              </body>
            </html>
          `);
        }

        const user = result.rows[0];
        (req.session as any).userId = user.id;
        (req.session as any).role = user.role || 'admin';
        (req.session as any).userName = user.name;

        await new Promise((resolve, reject) => {
          req.session.save((err) => err ? reject(err) : resolve(null));
        });

        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'instagram_login_success', user: ${JSON.stringify({
                    role: user.role,
                    name: user.name,
                    token: `${user.id}-${user.role}`
                  })} }, '*');
                  window.close();
                } else {
                  window.location.href = '/admin';
                }
              </script>
            </body>
          </html>
        `);
      } else {
        // Connect mode - requires being logged in
        const currentUserId = (req.session as any).userId;
        if (!currentUserId) {
          return res.status(401).send("Please login first to connect Instagram");
        }

        await pool.query(
          "INSERT INTO instagram_accounts (admin_user_id, username, access_token, instagram_business_account_id, facebook_page_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (instagram_business_account_id) DO UPDATE SET access_token = $3, username = $2, admin_user_id = $1",
          [currentUserId, username, accessToken, instagramBusinessAccountId, facebookPageId]
        );

        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage('instagram_connected', '*');
                  window.close();
                } else {
                  window.location.href = '/admin';
                }
              </script>
            </body>
          </html>
        `);
      }
    } catch (error: any) {
      console.error("Instagram OAuth Error:", error);
      res.status(500).send(`Error: ${error.message}`);
    }
  });

  app.get('/api/instagram/status', requireAuth, async (req, res) => {
    const currentUserId = (req as any).user.id;
    try {
      const result = await pool.query("SELECT username, updated_at FROM instagram_accounts WHERE admin_user_id = $1 ORDER BY updated_at DESC LIMIT 1", [currentUserId]);
      if (result.rows.length > 0) {
        res.json({ connected: true, account: result.rows[0] });
      } else {
        res.json({ connected: false });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  app.post('/api/instagram/sync', requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const currentUserId = (req as any).user.id;
    try {
      const accountRes = await pool.query("SELECT * FROM instagram_accounts WHERE admin_user_id = $1 ORDER BY updated_at DESC LIMIT 1", [currentUserId]);
      if (accountRes.rows.length === 0) return res.status(404).json({ error: "No account connected" });

      const account = accountRes.rows[0];
      const igId = account.instagram_business_account_id;
      const token = account.access_token;

      // Fetch insights
      const insightsRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/insights?metric=impressions,reach,follower_count&period=day&access_token=${token}`);
      const insightsData: any = await insightsRes.json();

      // Fetch media
      const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${token}`);
      const mediaData: any = await mediaRes.json();

      res.json({
        success: true,
        account_insights: insightsData.data,
        media: mediaData.data
      });
    } catch (error: any) {
      console.error("Instagram Sync Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Instagram Sync REMOVED

  async function notifyParent(participantId: number, type: string, message: string) {
    if (!pool) return;
    try {
      // 1. Save to DB
      await pool.query(
        "INSERT INTO notifications (participant_id, type, message) VALUES ($1, $2, $3)",
        [participantId, type, message]
      );

      // 2. Send to Telegram if chat_id exists
      const res = await pool.query("SELECT telegram_chat_id, name FROM participants WHERE id = $1", [participantId]);
      const participant = res.rows[0];
      
      if (participant && participant.telegram_chat_id) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const text = `<b>🔔 Сповіщення для батьків ${participant.name}</b>\n\n${message}`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: participant.telegram_chat_id,
              text: text,
              parse_mode: 'HTML'
            })
          });
        }
      }
    } catch (e) {
      console.error('Failed to notify parent:', e);
    }
  }

  // Telegram Webhook
  app.post("/api/telegram/webhook", async (req, res) => {
    const { message } = req.body;
    if (!message || !message.text) return res.sendStatus(200);

    const text = message.text;
    const chatId = message.chat.id;

    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const token = parts[1];
        const [type, id] = token.split("_");
        
        try {
          if (type === "p") {
            await pool.query("UPDATE participants SET telegram_chat_id = $1 WHERE id = $2", [chatId, id]);
            await sendTelegramMessage("✅ Ваш акаунт батьків успішно підключено!", String(chatId));
          } else if (type === "c") {
            await pool.query("UPDATE coaches SET telegram_chat_id = $1 WHERE id = $2", [chatId, id]);
            await sendTelegramMessage("✅ Ваш акаунт тренера успішно підключено!", String(chatId));
          }
        } catch (e) {
          console.error("Telegram connection error:", e);
        }
      } else {
        await sendTelegramMessage("👋 Вітаємо у Black Bear Dojo! Щоб підключити акаунт, скористайтеся кнопкою в особистому кабінеті.", String(chatId));
      }
    }
    
    res.sendStatus(200);
  });

  app.get("/api/telegram/bot-info", (req, res) => {
    res.json({
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'BlackBearDojoBot'
    });
  });

  async function sendTelegramMessage(text: string, customChatId?: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const defaultChatId = process.env.TELEGRAM_CHAT_ID;
    const chatId = customChatId || defaultChatId;
    
    if (!token || !chatId) {
      console.warn('Telegram notification skipped: TELEGRAM_BOT_TOKEN or chatId is missing.');
      return;
    }

    try {
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
    
    const sourceMap: Record<string, string> = {
      'main': 'Головна сторінка',
      'kids_landing': 'Діти (4-7 років)',
      'junior_landing': 'Юніори (7-12 років)',
      'teen_landing': 'Підлітки (12+ років)',
      'personal_landing': 'Індивідуальні тренування',
      'women_landing': 'Жіноче карате'
    };

    const sourceName = sourceMap[source] || source || 'Головна';

    try {
      if (pool) {
        await pool.query("INSERT INTO leads (name, phone, age_group, location) VALUES ($1, $2, $3, $4)", [name, phone, age_group, location]);
        console.log('Lead saved to database');
      } else {
        console.log('Database not configured, skipping lead save');
      }
      
      const message = `
<b>🔔 Нова заявка на пробне заняття!</b>
<b>Джерело:</b> ${sourceName}
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
  // Removed as per user request to avoid unnecessary notifications on login/startup
  /*
  setTimeout(() => {
    sendTelegramMessage(`<b>🚀 Системне оновлення</b>\n\nСистема Black Bear успішно запущена та готова до роботи.\nВсі модулі сповіщень активовані.`);
  }, 5000);
  */

  // --- End Scheduled Tasks ---

  app.delete("/api/leads/delete-all", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM leads");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete all leads" });
    }
  });

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
      const [contentRes, coachesRes, locationsRes, scheduleRes, groupsRes] = await Promise.all([
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
        `),
        pool.query(`
          SELECT g.*, l.name as location_name, c.name as coach_name 
          FROM groups g
          LEFT JOIN locations l ON g.location_id = l.id
          LEFT JOIN coaches c ON g.coach_id = c.id
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
        schedule: scheduleRes.rows,
        groups: groupsRes.rows
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

  app.get("/api/coaches/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM coaches WHERE id = $1", [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: "Coach not found" });
      res.json(result.rows[0]);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch coach" });
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

  app.get("/api/admin/recent-messages", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(`
        SELECT m.*, p.name as participant_name, g.name as group_name
        FROM messages m
        JOIN participants p ON m.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE m.sender_type = 'parent'
        ORDER BY m.created_at DESC
        LIMIT 10
      `);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
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
    console.log('Login attempt with:', req.body.login);
    
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        return res.status(400).json({ error: 'Login and password required' });
      }

      // Нормалізуємо телефон (видаляємо всі non-digits) для пошуку
      const normalizedPhone = normalizePhone(login);
      console.log('Normalized phone for login:', normalizedPhone);

      if (!pool) return res.status(500).json({ error: 'Database not configured' });

      // Пошук батька по телефону (в participants таблиці)
      let user = null;
      if (normalizedPhone.length >= 9) {
        const result = await pool.query(
          `SELECT id, name, phone, parent_phone, parent_password, parent_login 
           FROM participants 
           WHERE (phone IS NOT NULL OR parent_phone IS NOT NULL) AND (
             phone LIKE '%' || $1 OR 
             phone LIKE '%' || $2 OR
             parent_phone LIKE '%' || $1 OR
             parent_phone LIKE '%' || $2 OR
             parent_login = $3
           )
           LIMIT 1`,
          [normalizedPhone, login, login]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
          console.log('Found parent in participants:', user.id);
        }
      }

      // Якщо батька не знайдено - перевіримо адмінів
      if (!user) {
        const adminResult = await pool.query(
          `SELECT id, name, password as admin_password, role FROM admin_users WHERE login = $1 LIMIT 1`,
          [login]
        );
        if (adminResult.rows.length > 0) {
          user = { ...adminResult.rows[0], isAdmin: true };
          console.log('Found admin:', user.id);
        }
      }

      if (!user) {
        console.log('User not found:', login);
        return res.status(401).json({ error: 'Invalid login' });
      }

      // ===== БАТЬКІВ LOGIN =====
      if (!user.isAdmin) {
        let passwordMatch = false;
        
        // Спроба 1: bcrypt.compare (якщо пароль хешований)
        if (user.parent_password) {
          try {
            if (user.parent_password.startsWith('$2a$') || user.parent_password.startsWith('$2b$')) {
              passwordMatch = await bcrypt.compare(password, user.parent_password);
              console.log('Bcrypt compare result:', passwordMatch);
            } else {
              passwordMatch = (password === user.parent_password);
            }
          } catch (e: any) {
            console.log('Bcrypt compare failed, trying plain text:', e.message);
            passwordMatch = (password === user.parent_password);
          }
        }

        if (!passwordMatch) {
          console.log('Password mismatch for parent:', user.id);
          return res.status(401).json({ error: 'Invalid password' });
        }

        console.log('Parent login successful:', user.id);
        (req.session as any).userId = user.id;
        (req.session as any).participantId = user.id;
        (req.session as any).role = 'parent';
        (req.session as any).userName = user.name;

        return req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Session save failed' });
          }
          res.json({ 
            success: true, 
            role: 'parent', 
            name: user.name,
            participantId: user.id,
            redirect: '/parent'
          });
        });
      }

      // ===== АДМІН LOGIN =====
      else {
        let passwordMatch = false;
        
        try {
          if (user.admin_password && user.admin_password.startsWith('$2a$')) {
            passwordMatch = await bcrypt.compare(password, user.admin_password);
            console.log('Admin bcrypt compare result:', passwordMatch);
          } else {
            passwordMatch = (password === user.admin_password);
          }
        } catch (e: any) {
          console.log('Admin bcrypt compare failed, trying plain text:', e.message);
          passwordMatch = (password === user.admin_password);
        }

        if (!passwordMatch) {
          console.log('Password mismatch for admin:', user.id);
          return res.status(401).json({ error: 'Invalid password' });
        }

        console.log('Admin login successful:', user.id);
        (req.session as any).userId = user.id;
        (req.session as any).role = user.role || 'admin';
        (req.session as any).userName = user.name;

        return req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return res.status(500).json({ error: 'Session save failed' });
          }
          res.json({ 
            success: true, 
            role: user.role || 'admin', 
            name: user.name, 
            id: user.id,
            token: `${user.id}-${user.role || 'admin'}`,
            redirect: '/admin'
          });
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error: ' + (error as any).message });
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

  app.get("/api/participants/export", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query(`
        SELECT p.id, p.name, p.age, p.birthday, p.belt, p.rank_points, p.payment_status, p.status, p.parent_name, p.phone, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        ORDER BY p.name ASC
      `);
      
      const worksheet = xlsx.utils.json_to_sheet(result.rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, "Participants");
      
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=participants.xlsx');
      res.send(buffer);
    } catch (e) {
      console.error('Export failed:', e);
      res.status(500).json({ error: "Failed to export participants" });
    }
  });

  app.post("/api/register-member", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { children, parent_name, phone, parent_phone, password } = req.body;
    
    if (!children || !Array.isArray(children) || children.length === 0) {
      return res.status(400).json({ error: "No children data provided" });
    }

    // Use provided phone as login, or generate if missing
    const contactPhone = parent_phone || phone;
    const normalizedPhone = normalizePhone(contactPhone);
    const parent_login = normalizedPhone || `user_${Math.random().toString(36).substring(2, 8)}`;
    const rawPassword = password;
    
    if (!rawPassword) {
      return res.status(400).json({ error: "Password is required" });
    }
    
    try {
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const results = [];

      for (const child of children) {
        const { name, age, birthday, group_id, belt } = child;
        const result = await pool.query(
          "INSERT INTO participants (name, age, birthday, group_id, parent_name, phone, parent_phone, parent_login, parent_password, belt, payment_status, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
          [name, age, birthday || null, group_id || null, parent_name, phone, contactPhone, parent_login, hashedPassword, belt || 'Білий', 'unpaid', 'new']
        );
        results.push(result.rows[0].id);
      }
      
      // Send Telegram notification
      const childrenList = children.map(c => `- ${c.name} (${c.age} р.)`).join('\n');
      const message = `
<b>🆕 Нова реєстрація (${children.length} уч.)</b>
<b>Батько/Мати:</b> ${parent_name || 'Не вказано'}
<b>Телефон:</b> ${contactPhone}
<b>Діти:</b>
${childrenList}
<b>Логін:</b> ${parent_login}
<b>Пароль:</b> ${rawPassword}
      `;
      
      sendTelegramMessage(message).catch(err => console.error('Telegram notification failed:', err));

      // Auto-login: set session for the first registered child
      if (results.length > 0) {
        (req.session as any).participantId = results[0];
        return req.session.save((err) => {
          if (err) console.error('Session save error after registration:', err);
          res.json({ 
            success: true, 
            count: children.length,
            login: parent_login, 
            password: rawPassword 
          });
        });
      }

      res.json({ 
        success: true, 
        count: children.length,
        login: parent_login, 
        password: rawPassword 
      });
    } catch (e) {
      console.error('Registration failed:', e);
      res.status(500).json({ error: "Failed to register members" });
    }
  });

  app.post("/api/parent/send-credentials", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participantId } = req.body;
    
    try {
      const result = await pool.query(
        "SELECT name, parent_login, parent_password, telegram_chat_id, parent_name FROM participants WHERE id = $1",
        [participantId]
      );
      
      if (result.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
      
      const p = result.rows[0];
      const isHashed = p.parent_password?.startsWith('$2a$') || p.parent_password?.startsWith('$2b$');
      const passwordDisplay = isHashed ? "******** (зашифровано)" : p.parent_password;

      const message = `
<b>👋 Вітаємо у нашому Додзьо!</b>

Ось ваші дані для входу в особистий кабінет батьків:
<b>Учень:</b> ${p.name}
<b>Логін:</b> <code>${p.parent_login}</code>
<b>Пароль:</b> <code>${passwordDisplay}</code>
${isHashed ? '\n<i>Примітка: Ваш пароль зашифровано. Якщо ви його забули, зверніться до адміністратора для скидання.</i>\n' : ''}
<b>Посилання:</b> ${process.env.APP_URL || 'https://ais-dev-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app'}/portal

<i>Зберігайте ці дані в надійному місці.</i>
      `;
      
      if (p.telegram_chat_id) {
        await sendTelegramMessage(message, p.telegram_chat_id);
        res.json({ success: true, message: "Credentials sent via Telegram" });
      } else {
        res.status(400).json({ error: "Telegram Chat ID not set for this participant" });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to send credentials" });
    }
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
    const { name, age, birthday, group_id, parent_login, parent_password, payment_status, status, parent_name, phone, belt, achievements_text } = req.body;
    
    // Auto-generate credentials if missing
    const finalLogin = parent_login || phone || `parent_${Math.random().toString(36).substring(2, 8)}`;
    const rawPassword = parent_password || Math.random().toString(36).substring(2, 10);
    
    try {
      let hashedPassword = rawPassword;
      if (!hashedPassword.startsWith('$2a$')) {
        hashedPassword = await bcrypt.hash(rawPassword, 10);
      }
      await pool.query(
        "INSERT INTO participants (name, age, birthday, group_id, parent_login, parent_password, payment_status, status, parent_name, phone, belt, achievements_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        [name, age, birthday || null, group_id || null, finalLogin, hashedPassword, payment_status || 'unpaid', status || 'active', parent_name, phone, belt || 'Білий', achievements_text || '']
      );
      res.json({ success: true, parent_login: finalLogin, parent_password: rawPassword });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create participant" });
    }
  });

  app.put("/api/participants/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    
    try {
      const allowedKeys = [
        'name', 'age', 'birthday', 'group_id', 'parent_login', 'parent_password', 
        'belt', 'rank_points', 'payment_status', 'status', 'parent_name', 'phone', 
        'telegram_chat_id', 'exam_readiness', 'skill_checklist', 'streak', 'last_attendance_date',
        'achievements_text'
      ];
      
      const updateData: any = {};
      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          updateData[key] = req.body[key];
        }
      }
      
      // Get current participant to check parent_login
      const currentRes = await pool.query("SELECT parent_login FROM participants WHERE id = $1", [req.params.id]);
      if (currentRes.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
      const oldParentLogin = currentRes.rows[0]?.parent_login;

      // Handle password hashing if provided
      if (updateData.parent_password && !updateData.parent_password.startsWith('$2a$')) {
        updateData.parent_password = await bcrypt.hash(updateData.parent_password, 10);
      }

      // Handle empty birthday
      if (updateData.birthday === '') updateData.birthday = null;

      // Handle skill_checklist JSON conversion
      if (updateData.skill_checklist !== undefined && typeof updateData.skill_checklist === 'string') {
        try {
          JSON.parse(updateData.skill_checklist);
        } catch (e) {
          updateData.skill_checklist = JSON.stringify(updateData.skill_checklist.split(',').map((s: string) => s.trim()).filter(Boolean));
        }
      }

      const keys = Object.keys(updateData);
      
      if (keys.length === 0) {
        return res.json({ success: true, message: "No fields to update" });
      }

      const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      const values = keys.map(key => updateData[key]);
      const participantId = req.params.id;
      values.push(participantId);

      await pool.query(
        `UPDATE participants SET ${setClause} WHERE id = $${values.length}`,
        values
      );

      // If parent credentials changed, sync them for all children of this parent
      if ((updateData.parent_login || updateData.parent_password) && oldParentLogin) {
        const syncFields = [];
        const syncValues = [];
        if (updateData.parent_login) {
          syncFields.push(`parent_login = $${syncValues.length + 1}`);
          syncValues.push(updateData.parent_login);
        }
        if (updateData.parent_password) {
          syncFields.push(`parent_password = $${syncValues.length + 1}`);
          syncValues.push(updateData.parent_password);
        }
        
        if (syncFields.length > 0) {
          syncValues.push(oldParentLogin);
          await pool.query(
            `UPDATE participants SET ${syncFields.join(', ')} WHERE parent_login = $${syncValues.length}`,
            syncValues
          );
        }
      }

      res.json({ success: true });
    } catch (e) {
      console.error('Update participant failed:', e);
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

  app.put("/api/participants/:id/progress", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { id } = req.params;
    const { exam_readiness, skill_checklist } = req.body;
    try {
      await pool.query(
        "UPDATE participants SET exam_readiness = $1, skill_checklist = $2 WHERE id = $3",
        [exam_readiness, JSON.stringify(skill_checklist), id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update progress" });
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
      
      notifyParent(participant_id, 'achievement', `Нове досягнення: ${type}! +10 балів до рейтингу.`);
      
      console.log(`Badge added for participant ${participant_id}: 10 points awarded`);
      res.json({ success: true, points_awarded: 10 });
    } catch (e) {
      await pool.query("ROLLBACK");
      console.error("Failed to create badge:", e);
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
    if (!participant_id || !name) {
      return res.status(400).json({ error: "Participant ID and name are required" });
    }
    try {
      await pool.query("BEGIN");
      const insertRes = await pool.query(
        "INSERT INTO competitions (participant_id, name, type, result, date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [participant_id, name, type, result, date]
      );
      const compId = insertRes.rows[0].id;
      
      // Points logic
      let points = 5; // Default participation
      
      const normalizedResult = result?.toLowerCase()?.trim() || "";
      if (type === 'competition') {
        if (normalizedResult.includes('1 місце') || normalizedResult === '1' || normalizedResult === '1st') points = 30;
        else if (normalizedResult.includes('2 місце') || normalizedResult === '2' || normalizedResult === '2nd') points = 20;
        else if (normalizedResult.includes('3 місце') || normalizedResult === '3' || normalizedResult === '3rd') points = 15;
        else if (normalizedResult === 'participation' || normalizedResult === 'участь') points = 5;
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
      
      notifyParent(participant_id, 'event', `Участь у заході: ${name}. Результат: ${result}. +${points} балів.`);
      
      console.log(`Competition added for participant ${participant_id}: ${points} points awarded`);
      res.json({ success: true, points_awarded: points });
    } catch (e) {
      await pool.query("ROLLBACK");
      console.error("Failed to create competition entry:", e);
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
  const runWorkflows = async () => {
    if (!pool) return;
    try {
      // 1. Absence Alerts (2+ consecutive absences)
      const absenceResult = await pool.query(`
        WITH recent_attendance AS (
          SELECT participant_id, status, date,
                 ROW_NUMBER() OVER (PARTITION BY participant_id ORDER BY date DESC) as rn
          FROM attendance
        )
        SELECT participant_id, COUNT(*) as absent_count
        FROM recent_attendance
        WHERE rn <= 2 AND status = 'absent'
        GROUP BY participant_id
        HAVING COUNT(*) >= 2
      `);

      for (const row of absenceResult.rows) {
        // Check if notification already exists for today
        const exists = await pool.query(
          "SELECT 1 FROM notifications WHERE participant_id = $1 AND type = 'absence' AND created_at > CURRENT_DATE",
          [row.participant_id]
        );
        if (exists.rowCount === 0) {
          await pool.query(
            "INSERT INTO notifications (participant_id, type, message) VALUES ($1, 'absence', 'Ваша дитина пропустила 2 тренування поспіль. Будь ласка, підтвердіть причину відсутності.')",
            [row.participant_id]
          );
        }
      }

      // 2. Churn Risk (14+ days since last attendance)
      const churnResult = await pool.query(`
        SELECT id, name, coach_id
        FROM participants
        WHERE status = 'active'
        AND (last_attendance_date < CURRENT_DATE - INTERVAL '14 days' OR (last_attendance_date IS NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '14 days'))
      `);

      for (const row of churnResult.rows) {
        // Notify coach/admin (using a system notification or just logging for now)
        console.log(`Churn risk detected for ${row.name} (ID: ${row.id})`);
      }
    } catch (e) {
      console.error("Workflow error:", e);
    }
  };

  app.post("/api/admin/run-workflows", requireAuth, async (req, res) => {
    await runWorkflows();
    res.json({ success: true });
  });

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
            (SELECT COUNT(*) FROM leads WHERE assigned_coach_id = $1) as total_leads,
            (SELECT COUNT(*) FROM leads WHERE assigned_coach_id = $1 AND status = 'new') as new_leads,
            1 as total_coaches,
            (SELECT COUNT(*) FROM groups WHERE coach_id = $1) as total_locations,
            (SELECT COUNT(*) FROM participants p JOIN groups g ON p.group_id = g.id WHERE g.coach_id = $1 AND p.status = 'active') as total_participants,
            (SELECT COUNT(*) FROM participants p JOIN groups g ON p.group_id = g.id WHERE p.payment_status = 'unpaid' AND g.coach_id = $1 AND p.status = 'active') as unpaid_participants,
            (SELECT COALESCE(SUM(amount), 0) FROM payments pay JOIN participants p ON pay.participant_id = p.id JOIN groups g ON p.group_id = g.id WHERE g.coach_id = $1 AND pay.month = EXTRACT(MONTH FROM CURRENT_DATE) AND pay.year = EXTRACT(YEAR FROM CURRENT_DATE)) as monthly_revenue,
            (SELECT ROUND(AVG(CAST(p_count AS FLOAT) / NULLIF(capacity, 0) * 100)) FROM (SELECT g.capacity, COUNT(p.id) as p_count FROM groups g LEFT JOIN participants p ON g.id = p.group_id AND p.status = 'active' WHERE g.coach_id = $1 GROUP BY g.id, g.capacity) as occupancy) as avg_occupancy
        `;
        totalsParams.push(user.coach_id);
      } else {
        totalsQuery = `
          SELECT 
            (SELECT COUNT(*) FROM leads) as total_leads,
            (SELECT COUNT(*) FROM leads WHERE status = 'new') as new_leads,
            (SELECT COUNT(*) FROM coaches) as total_coaches,
            (SELECT COUNT(*) FROM locations) as total_locations,
            (SELECT COUNT(*) FROM participants WHERE status = 'active') as total_participants,
            (SELECT COUNT(*) FROM participants WHERE payment_status = 'unpaid' AND status = 'active') as unpaid_participants,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) AND year = EXTRACT(YEAR FROM CURRENT_DATE)) as monthly_revenue,
            (SELECT ROUND(AVG(CAST(p_count AS FLOAT) / NULLIF(capacity, 0) * 100)) FROM (SELECT g.capacity, COUNT(p.id) as p_count FROM groups g LEFT JOIN participants p ON g.id = p.group_id AND p.status = 'active' GROUP BY g.id, g.capacity) as occupancy) as avg_occupancy
        `;
      }

      const [leadsByDay, groupDistribution, recentLeads, totals, debtors, churnRisk] = await Promise.all([
        pool.query(`
          SELECT DATE(created_at) as date, COUNT(*) as count 
          FROM leads 
          WHERE created_at > CURRENT_DATE - INTERVAL '14 days'
          ${user.role === 'coach' ? 'AND assigned_coach_id = $1' : ''}
          GROUP BY DATE(created_at)
          ORDER BY DATE(created_at) ASC
        `, user.role === 'coach' ? [user.coach_id] : []),
        pool.query(groupDistQuery, groupDistParams),
        pool.query(`
          SELECT * FROM leads 
          ${user.role === 'coach' ? 'WHERE assigned_coach_id = $1' : ''}
          ORDER BY created_at DESC 
          LIMIT 5
        `, user.role === 'coach' ? [user.coach_id] : []),
        pool.query(totalsQuery, totalsParams),
        pool.query(`
          SELECT p.id, p.name, p.phone, g.name as group_name
          FROM participants p
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE p.payment_status = 'unpaid'
          ${user.role === 'coach' ? 'AND g.coach_id = $1' : ''}
          LIMIT 5
        `, user.role === 'coach' ? [user.coach_id] : []),
        pool.query(`
          SELECT p.id, p.name, g.name as group_name, p.last_attendance_date,
                 (CURRENT_DATE - COALESCE(p.last_attendance_date, p.created_at::date)) as days_since_last
          FROM participants p
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE p.status = 'active'
          AND (p.last_attendance_date < CURRENT_DATE - INTERVAL '14 days' OR p.last_attendance_date IS NULL)
          ${user.role === 'coach' ? 'AND g.coach_id = $1' : ''}
          ORDER BY p.last_attendance_date ASC NULLS FIRST
          LIMIT 5
        `, user.role === 'coach' ? [user.coach_id] : [])
      ]);

      res.json({
        leadsOverTime: leadsByDay.rows,
        groupDistribution: groupDistribution.rows,
        recentLeads: recentLeads.rows,
        totals: totals.rows[0],
        debtors: debtors.rows,
        churnRisk: churnRisk.rows
      });
    } catch (e) {
      console.error('Dashboard stats error:', e);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ===== SMM AGENCY ROUTES =====
  app.get("/api/smm/posts", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM smm_posts ORDER BY created_at DESC");
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/smm/posts", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { title, audience, goal, pain, format, source_signal, score, reason, content, scoring, status } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO smm_posts (title, audience, goal, pain, format, source_signal, score, reason, content, scoring, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [title, audience, goal, pain, format, source_signal, score, reason, JSON.stringify(content), JSON.stringify(scoring), status || 'generated']
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/smm/posts/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { id } = req.params;
    const { status, metrics, result_tag, notes, published_at } = req.body;
    try {
      const result = await pool.query(
        `UPDATE smm_posts SET 
         status = COALESCE($1, status), 
         metrics = COALESCE($2, metrics), 
         result_tag = COALESCE($3, result_tag),
         notes = COALESCE($4, notes),
         published_at = COALESCE($5, published_at),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 RETURNING *`,
        [status, metrics ? JSON.stringify(metrics) : null, result_tag, notes, published_at, id]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/smm/strategy/latest", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM smm_strategy ORDER BY week_start DESC LIMIT 1");
      res.json(result.rows[0] || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/smm/strategy", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { week_start, strategy_text, patterns, blind_spots, swot } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO smm_strategy (week_start, strategy_text, patterns, blind_spots, swot) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (week_start) DO UPDATE SET 
         strategy_text = EXCLUDED.strategy_text, 
         patterns = EXCLUDED.patterns, 
         blind_spots = EXCLUDED.blind_spots, 
         swot = EXCLUDED.swot 
         RETURNING *`,
        [week_start, strategy_text, JSON.stringify(patterns), JSON.stringify(blind_spots), JSON.stringify(swot)]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/smm/pains", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM smm_pains ORDER BY signal_strength DESC");
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/smm/analysis/latest", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM smm_account_analysis ORDER BY analysis_date DESC LIMIT 1");
      res.json(result.rows[0] || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/smm/analysis", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { strengths, weaknesses, missing_content, adjacent_opportunities, recommendations } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO smm_account_analysis (strengths, weaknesses, missing_content, adjacent_opportunities, recommendations) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [JSON.stringify(strengths), JSON.stringify(weaknesses), JSON.stringify(missing_content), JSON.stringify(adjacent_opportunities), JSON.stringify(recommendations)]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/smm/metrics", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("SELECT * FROM smm_account_metrics ORDER BY date DESC LIMIT 30");
      res.json(result.rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/smm/metrics", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { followers, following, posts_count, engagement_rate, reach, impressions, date } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO smm_account_metrics (followers, following, posts_count, engagement_rate, reach, impressions, date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (date) DO UPDATE SET 
         followers = EXCLUDED.followers,
         following = EXCLUDED.following,
         posts_count = EXCLUDED.posts_count,
         engagement_rate = EXCLUDED.engagement_rate,
         reach = EXCLUDED.reach,
         impressions = EXCLUDED.impressions
         RETURNING *`,
        [followers, following, posts_count, engagement_rate, reach, impressions, date || new Date().toISOString().split('T')[0]]
      );
      res.json(result.rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Payments API
  app.get("/api/payments", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    const { month, year, participant_id } = req.query;
    try {
      let query = `
        SELECT pay.*, p.name as participant_name, g.name as group_name
        FROM payments pay
        JOIN participants p ON pay.participant_id = p.id
        JOIN groups g ON p.group_id = g.id
      `;
      let params: any[] = [];
      let conditions: string[] = [];

      if (user.role === 'coach' && user.coach_id) {
        conditions.push("g.coach_id = $" + (params.length + 1));
        params.push(user.coach_id);
      }

      if (month) {
        conditions.push("pay.month = $" + (params.length + 1));
        params.push(month);
      }
      if (year) {
        conditions.push("pay.year = $" + (params.length + 1));
        params.push(year);
      }
      if (participant_id) {
        conditions.push("pay.participant_id = $" + (params.length + 1));
        params.push(participant_id);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY pay.date DESC";

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participant_id, amount, date, month, year, type, method, notes } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [participant_id, amount, date || new Date(), month, year, type || 'subscription', method || 'cash', notes]
      );
      
      // Update participant payment status if it's a subscription for current month
      const now = new Date();
      if (type === 'subscription' && parseInt(month) === (now.getMonth() + 1) && parseInt(year) === now.getFullYear()) {
        await pool.query("UPDATE participants SET payment_status = 'paid' WHERE id = $1", [participant_id]);
      }

      // Notify parents
      notifyParent(participant_id, 'payment', `Отримано оплату: ${amount} ₴ за ${month}/${year}. Дякуємо!`);

      res.json({ success: true, id: result.rows[0].id });
    } catch (e) {
      console.error("Failed to create payment:", e);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.delete("/api/payments/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM payments WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT n.*, p.name as participant_name
        FROM notifications n
        JOIN participants p ON n.participant_id = p.id
        JOIN groups g ON p.group_id = g.id
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        query += " WHERE g.coach_id = $1";
        params.push(user.coach_id);
      }
      query += " ORDER BY n.created_at DESC LIMIT 100";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.delete("/api/notifications", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    try {
      if (user.role === 'admin') {
        await pool.query("DELETE FROM notifications");
      } else if (user.role === 'coach' && user.coach_id) {
        await pool.query(`
          DELETE FROM notifications 
          WHERE participant_id IN (
            SELECT p.id FROM participants p 
            JOIN groups g ON p.group_id = g.id 
            WHERE g.coach_id = $1
          )
        `, [user.coach_id]);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      await pool.query("DELETE FROM notifications WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Financial Reports
  app.get("/api/reports/finance", requireAuth, async (req, res) => {
    if (!pool) return res.json({});
    const user = (req as any).user;
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();
    
    try {
      let query = `
        SELECT month, SUM(amount) as total
        FROM payments
        WHERE year = $1
      `;
      let params: any[] = [targetYear];

      if (user.role === 'coach' && user.coach_id) {
        query = `
          SELECT pay.month, SUM(pay.amount) as total
          FROM payments pay
          JOIN participants p ON pay.participant_id = p.id
          JOIN groups g ON p.group_id = g.id
          WHERE pay.year = $1 AND g.coach_id = $2
          GROUP BY pay.month
        `;
        params.push(user.coach_id);
      } else {
        query += " GROUP BY month";
      }

      const result = await pool.query(query, params);
      
      // Group by type
      let typeQuery = `
        SELECT type, SUM(amount) as total
        FROM payments
        WHERE year = $1
      `;
      let typeParams: any[] = [targetYear];
      if (user.role === 'coach' && user.coach_id) {
        typeQuery = `
          SELECT pay.type, SUM(pay.amount) as total
          FROM payments pay
          JOIN participants p ON pay.participant_id = p.id
          JOIN groups g ON p.group_id = g.id
          WHERE pay.year = $1 AND g.coach_id = $2
          GROUP BY pay.type
        `;
        typeParams.push(user.coach_id);
      } else {
        typeQuery += " GROUP BY type";
      }
      const typeResult = await pool.query(typeQuery, typeParams);

      res.json({
        monthly: result.rows,
        byType: typeResult.rows
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch financial report" });
    }
  });

  app.post("/api/admin/notify", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { participantId, message } = req.body;
    try {
      await notifyParent(participantId, 'manual', message);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/admin/notify/mass", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { message, group_id } = req.body;
    try {
      let query = "SELECT id FROM participants WHERE status = 'active'";
      let params = [];
      if (group_id && group_id !== 'all') {
        query += " AND group_id = $1";
        params.push(group_id);
      }
      const result = await pool.query(query, params);
      const participants = result.rows;
      
      // Send notifications in background
      Promise.all(participants.map(p => notifyParent(p.id, 'manual', message)))
        .catch(err => console.error('Mass notify background error:', err));
        
      res.json({ success: true, count: participants.length });
    } catch (e) {
      res.status(500).json({ error: "Failed to send mass notification" });
    }
  });

  // Messaging API
  app.get("/api/messages/:participantId", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query(
        "SELECT * FROM messages WHERE participant_id = $1 ORDER BY created_at ASC",
        [req.params.participantId]
      );
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { participant_id, content, sender_type } = req.body;
    const user = (req as any).user;
    
    try {
      let sender_id = null;
      if (sender_type === 'coach') sender_id = user.coach_id;
      else if (sender_type === 'admin') sender_id = user.id;

      const result = await pool.query(
        "INSERT INTO messages (participant_id, content, sender_type, sender_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [participant_id, content, sender_type, sender_id]
      );

      // If parent sends to coach, notify coach via Telegram if possible
      if (sender_type === 'parent') {
        const coachRes = await pool.query(`
          SELECT c.telegram_chat_id, p.name as child_name 
          FROM participants p 
          JOIN groups g ON p.group_id = g.id 
          JOIN coaches c ON g.coach_id = c.id 
          WHERE p.id = $1
        `, [participant_id]);
        
        if (coachRes.rows[0]?.telegram_chat_id) {
          const token = process.env.TELEGRAM_BOT_TOKEN;
          if (token) {
            const text = `<b>📩 Нове повідомлення від батьків ${coachRes.rows[0].child_name}</b>\n\n${content}`;
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: coachRes.rows[0].telegram_chat_id,
                text: text,
                parse_mode: 'HTML'
              })
            }).catch(err => console.error('Telegram notify coach error:', err));
          }
        }
      } else {
        // If coach/admin sends to parent, notify parent via Telegram
        notifyParent(participant_id, 'message', `Нове повідомлення від тренера: ${content}`);
      }

      res.json(result.rows[0]);
    } catch (e) {
      console.error('Failed to send message:', e);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Admin Users Management
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT id, login, role, name, coach_id FROM admin_users ORDER BY name ASC");
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { login, password, role, name, coach_id } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        "INSERT INTO admin_users (login, password, role, name, coach_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [login, hashedPassword, role, name, coach_id || null]
      );
      res.json(result.rows[0]);
    } catch (e) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { login, password, role, name, coach_id } = req.body;
    const { id } = req.params;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          "UPDATE admin_users SET login = $1, password = $2, role = $3, name = $4, coach_id = $5 WHERE id = $6",
          [login, hashedPassword, role, name, coach_id || null, id]
        );
      } else {
        await pool.query(
          "UPDATE admin_users SET login = $1, role = $2, name = $3, coach_id = $4 WHERE id = $5",
          [login, role, name, coach_id || null, id]
        );
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM admin_users WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete user" });
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
    const { participant_id, date, status, notes } = req.body;
    const coach_id = (req as any).user?.role === 'coach' ? (req as any).user?.id : null;

    try {
      await pool.query("BEGIN");
      
      // Check if attendance already exists
      const existing = await pool.query(
        "SELECT status FROM attendance WHERE participant_id = $1 AND date = $2",
        [participant_id, date]
      );

      await pool.query(
        "INSERT INTO attendance (participant_id, date, status, notes, coach_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(participant_id, date) DO UPDATE SET status=EXCLUDED.status, notes=EXCLUDED.notes, coach_id=EXCLUDED.coach_id",
        [participant_id, date, status, notes || null, coach_id]
      );

      // Points and Streak logic
      if (status === 'present' && (!existing.rows[0] || existing.rows[0].status !== 'present')) {
        // Points
        await pool.query(
          "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
          [participant_id, 1, 'attendance', date]
        );
        
        // Streak logic
        const pRes = await pool.query("SELECT streak, last_attendance_date FROM participants WHERE id = $1", [participant_id]);
        const p = pRes.rows[0];
        let newStreak = 1;
        
        if (p.last_attendance_date) {
          const lastDate = new Date(p.last_attendance_date);
          const currentDate = new Date(date);
          // Use UTC for comparison to avoid timezone issues
          const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays <= 4 && diffDays > 0) { // Allow up to 4 days gap, but only if it's a forward date
            newStreak = (p.streak || 0) + 1;
          } else if (diffDays <= 0) {
            // If marking past date, keep current streak
            newStreak = p.streak || 1;
          }
        }
        
        // Only update last_attendance_date if the new date is more recent
        const updateQuery = p.last_attendance_date && new Date(date) <= new Date(p.last_attendance_date)
          ? "UPDATE participants SET rank_points = rank_points + 1, streak = $1 WHERE id = $2"
          : "UPDATE participants SET rank_points = rank_points + 1, streak = $1, last_attendance_date = $2 WHERE id = $3";
        
        const updateParams = p.last_attendance_date && new Date(date) <= new Date(p.last_attendance_date)
          ? [newStreak, participant_id]
          : [newStreak, date, participant_id];

        await pool.query(updateQuery, updateParams);
      } else if (status === 'absent' && existing.rows[0] && existing.rows[0].status === 'present') {
        // Removal
        await pool.query(
          "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
          [participant_id, -1, 'attendance_removal', date]
        );
        await pool.query("UPDATE participants SET rank_points = GREATEST(0, rank_points - 1), streak = 0 WHERE id = $1", [participant_id]);
      }

      await pool.query("COMMIT");
      
      // Trigger workflows in background
      runWorkflows().catch(console.error);

      // Notify parents asynchronously
      if (status === 'absent' || status === 'late') {
        const statusText = status === 'absent' ? 'відсутній(я)' : 'запізнився(лася)';
        notifyParent(participant_id, 'attendance', `Ваша дитина ${statusText} на занятті сьогодні (${date}).`);
      }

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

    // Parent Portal Endpoints
    // Announcements
  app.get("/api/announcements", async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const result = await pool.query("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50");
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  app.post("/api/announcements", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { title, content } = req.body;
    const adminId = (req as any).adminId;

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO announcements (title, content, author_id) VALUES ($1, $2, $3) RETURNING *",
        [title, content, adminId]
      );
      
      // Also send to Telegram if configured
      const telegramMessage = `
<b>📢 НОВЕ ОГОЛОШЕННЯ!</b>
<b>${title}</b>

${content}
      `;
      sendTelegramMessage(telegramMessage).catch(err => console.error('Failed to send announcement to Telegram:', err));

      res.json(result.rows[0]);
    } catch (e) {
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  app.delete("/api/announcements/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM announcements WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete announcement" });
    }
  });

  app.get("/api/parent/notifications", async (req, res) => {
    if (!pool) return res.json([]);
    const participantId = (req.session as any).participantId;
    if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });
    
    try {
      const result = await pool.query(
        "SELECT * FROM notifications WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 20",
        [participantId]
      );
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

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

    app.get("/api/parent/children", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const meRes = await pool.query("SELECT parent_login, parent_phone, phone FROM participants WHERE id = $1", [participantId]);
        if (meRes.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
        
        const { parent_login, parent_phone, phone } = meRes.rows[0];
        const normalizedPhone = normalizePhone(parent_phone || phone || "");

        let query = `
          SELECT 
            p.id, p.name, p.age, p.belt, p.rank_points, p.payment_status, p.streak, p.exam_readiness,
            g.name as group_name,
            (SELECT status FROM attendance WHERE participant_id = p.id AND date = CURRENT_DATE LIMIT 1) as today_status,
            (SELECT COUNT(*) FROM attendance WHERE participant_id = p.id AND status = 'present') as total_attendance
          FROM participants p 
          LEFT JOIN groups g ON p.group_id = g.id 
          WHERE 1=0
        `;
        const params = [];

        if (parent_login) {
          params.push(parent_login);
          query += ` OR p.parent_login = $${params.length}`;
        }
        
        if (normalizedPhone) {
          params.push(normalizedPhone);
          query += ` OR REGEXP_REPLACE(p.parent_phone, '[^\\d]', '', 'g') = $${params.length}`;
          query += ` OR REGEXP_REPLACE(p.phone, '[^\\d]', '', 'g') = $${params.length}`;
          query += ` OR p.parent_login = $${params.length}`;
        }

        const childrenRes = await pool.query(query, params);
        res.json(childrenRes.rows);
      } catch (e) {
        console.error('Fetch children error:', e);
        res.status(500).json({ error: "Failed to fetch children" });
      }
    });

    app.post("/api/parent/absence-confirm", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in" });
      
      const { date, reason } = req.body;
      try {
        await pool.query(
          "UPDATE attendance SET status = 'excused', notes = $1 WHERE participant_id = $2 AND date = $3",
          [reason, participantId, date]
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: "Failed to confirm absence" });
      }
    });

    app.post("/api/parent/switch-child", async (req, res) => {
      const { childId } = req.body;
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in" });

      try {
        const meRes = await pool.query("SELECT parent_login FROM participants WHERE id = $1", [participantId]);
        const childRes = await pool.query("SELECT parent_login FROM participants WHERE id = $1", [childId]);
        
        if (meRes.rows.length > 0 && childRes.rows.length > 0 && meRes.rows[0].parent_login === childRes.rows[0].parent_login) {
          (req.session as any).participantId = childId;
          return req.session.save(() => {
            res.json({ success: true });
          });
        }
        res.status(403).json({ error: "Forbidden" });
      } catch (e) {
        res.status(500).json({ error: "Failed to switch child" });
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

    app.get("/api/parent/payments", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = (req.session as any).participantId;
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const result = await pool.query("SELECT * FROM payments WHERE participant_id = $1 ORDER BY year DESC, month DESC", [participantId]);
        res.json(result.rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch payments" });
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

        const gRes = await pool.query("SELECT name, location_id, coach_id FROM groups WHERE id = $1", [groupId]);
        if (gRes.rows.length === 0) return res.json([]);
        
        const { name: groupName, location_id: locId, coach_id: coachId } = gRes.rows[0];

        const sRes = await pool.query(`
          SELECT s.*, c.name as coach_name, l.name as location_name 
          FROM schedule s 
          LEFT JOIN coaches c ON s.coach_id = c.id 
          LEFT JOIN locations l ON s.location_id = l.id 
          WHERE (s.group_name ILIKE $1 || '%' OR s.group_name ILIKE '%' || $1 || '%' OR $1 ILIKE '%' || s.group_name || '%')
             OR (s.location_id = $2 AND s.coach_id = $3 AND s.group_name IS NOT NULL)
          ORDER BY s.order_index ASC
        `, [groupName, locId, coachId]);
        
        res.json(sRes.rows);
      } catch (e) {
        console.error("Failed to fetch parent schedule:", e);
        res.status(500).json({ error: "Failed to fetch schedule" });
      }
    });

    // ===== PARENT PORTAL ROUTES =====
    app.get('/api/parent/:parentId/belt-progress', async (req, res) => {
      try {
        const { parentId } = req.params;
        const result = await pool.query(
          `SELECT id, name as first_name, belt as belt_level, updated_at as belt_updated_at 
           FROM participants 
           WHERE parent_login = (SELECT parent_login FROM participants WHERE id = $1)
           OR id = $1 
           ORDER BY name ASC`,
          [parentId]
        );
        res.json({ children: result.rows });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/parent/:parentId/attendance-streak', async (req, res) => {
      try {
        const { parentId } = req.params;
        const result = await pool.query(
          `SELECT p.id, p.name as first_name, COUNT(a.id) as total_attendance 
           FROM participants p 
           LEFT JOIN attendance a ON p.id = a.participant_id AND a.date >= NOW() - INTERVAL '30 days'
           WHERE p.parent_login = (SELECT parent_login FROM participants WHERE id = $1) OR p.id = $1
           GROUP BY p.id, p.name ORDER BY p.name ASC`,
          [parentId]
        );
        res.json({ children: result.rows });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // ===== COACH ROUTES =====
    app.post('/api/coach/attendance/bulk', async (req, res) => {
      try {
        const { attendance_records } = req.body; // [{participant_id, date, status}]
        for (const record of attendance_records) {
          await pool.query(
            `INSERT INTO attendance (participant_id, date, status) 
             VALUES ($1, $2, $3)
             ON CONFLICT (participant_id, date) DO UPDATE SET status = $3`,
            [record.participant_id, record.date, record.status]
          );
        }
        res.json({ success: true, count: attendance_records.length });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/coach/notes/:participantId', async (req, res) => {
      try {
        const { participantId } = req.params;
        const { note, date } = req.body;
        const result = await pool.query(
          `INSERT INTO attendance (participant_id, date, coach_notes) 
           VALUES ($1, $2, $3) RETURNING *`,
          [participantId, date, note]
        );
        res.json(result.rows[0]);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
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

