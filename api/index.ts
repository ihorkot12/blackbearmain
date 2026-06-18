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
import ExcelJS from 'exceljs';
import cron from 'node-cron';
import fetch from 'node-fetch';
const { Pool } = pkg;

dotenv.config();

const isBcryptHash = (value: unknown): value is string =>
  typeof value === 'string' && /^\$2[aby]\$/.test(value);

const normalizeBeltName = (belt: unknown) => {
  const value = String(belt || '').trim();
  if (!value) return 'Білий';

  return value
    .replace(/\s+з[і]?\s+(синьою|жовтою|зеленою|коричневою|золотою|чорною)\s+смужкою/gi, ' зі сріблястою смужкою')
    .replace(/\s+зі\s+смужкою/gi, ' зі сріблястою смужкою');
};

// Session secret - MUST be stable on Vercel. Prefer an explicit secret, but
// fall back to DATABASE_URL-derived entropy instead of a public hard-coded key.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.AUTH_TOKEN_SECRET ||
  (process.env.DATABASE_URL
    ? crypto.createHash('sha256').update(`black-bear-session:${process.env.DATABASE_URL}`).digest('hex')
    : 'black-bear-local-dev-secret');

if (!process.env.SESSION_SECRET && !process.env.AUTH_TOKEN_SECRET && process.env.DATABASE_URL) {
  console.warn('SESSION_SECRET/AUTH_TOKEN_SECRET is not set; using a DATABASE_URL-derived fallback.');
}

type AuthTokenRole = 'admin' | 'coach' | 'parent';
type AuthTokenPayload = {
  sub: string;
  role: AuthTokenRole;
  accessId?: number | null;
  iat: number;
  exp: number;
};

const AUTH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUTH_TOKEN_PREFIX = 'bb1';

const signAuthTokenPayload = (encodedPayload: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(encodedPayload).digest('base64url');

const createAuthToken = (params: { id: number | string; role: AuthTokenRole; accessId?: number | null }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthTokenPayload = {
    sub: String(params.id),
    role: params.role,
    accessId: params.accessId ?? null,
    iat: now,
    exp: now + AUTH_TOKEN_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${AUTH_TOKEN_PREFIX}.${encodedPayload}.${signAuthTokenPayload(encodedPayload)}`;
};

const verifyAuthToken = (token: string): AuthTokenPayload | null => {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== AUTH_TOKEN_PREFIX) return null;

  const [, encodedPayload, signature] = parts;
  const expectedSignature = signAuthTokenPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (!payload.sub || !/^\d+$/.test(payload.sub)) return null;
    if (!['admin', 'coach', 'parent'].includes(payload.role)) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
};

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
      // Keep parent_login untouched: admins/coaches can use custom logins, not only phones.

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
        email TEXT,
        member_type TEXT DEFAULT 'child',
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
        reference_type TEXT,
        reference_id TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;

      CREATE TABLE IF NOT EXISTS participant_accesses (
        id SERIAL PRIMARY KEY,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        access_type TEXT DEFAULT 'guardian',
        name TEXT,
        phone TEXT,
        login TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        can_login BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_participant_accesses_participant_id ON participant_accesses(participant_id);
      CREATE INDEX IF NOT EXISTS idx_participant_accesses_login ON participant_accesses(LOWER(login));

      ALTER TABLE participants ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE participants ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'child';
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
        instagram_business_account_id TEXT UNIQUE,
        facebook_page_id TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE instagram_accounts ADD COLUMN IF NOT EXISTS admin_user_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_accounts_instagram_business_account_id_key') THEN
          ALTER TABLE instagram_accounts ADD CONSTRAINT instagram_accounts_instagram_business_account_id_key UNIQUE (instagram_business_account_id);
        END IF;
      END $$;

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

      CREATE TABLE IF NOT EXISTS homework_assignments (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        focus TEXT DEFAULT 'technique',
        difficulty TEXT DEFAULT 'medium',
        estimated_minutes INTEGER DEFAULT 15,
        due_date DATE,
        group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
        coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL,
        created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
        exercises JSONB DEFAULT '[]'::jsonb,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS homework_assignment_participants (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES homework_assignments(id) ON DELETE CASCADE,
        participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'assigned',
        diary_entries JSONB DEFAULT '[]'::jsonb,
        total_minutes INTEGER DEFAULT 0,
        parent_comment TEXT,
        coach_feedback TEXT,
        points_awarded INTEGER DEFAULT 0,
        submitted_at TIMESTAMP,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id, participant_id)
      );

      CREATE INDEX IF NOT EXISTS idx_homework_assignments_group_id ON homework_assignments(group_id);
      CREATE INDEX IF NOT EXISTS idx_homework_assignments_coach_id ON homework_assignments(coach_id);
      CREATE INDEX IF NOT EXISTS idx_homework_assignment_participants_assignment_id ON homework_assignment_participants(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_homework_assignment_participants_participant_id ON homework_assignment_participants(participant_id);

      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS focus TEXT DEFAULT 'technique';
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER DEFAULT 15;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS due_date DATE;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS coach_id INTEGER REFERENCES coaches(id) ON DELETE SET NULL;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS exercises JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE homework_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'assigned';
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS diary_entries JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS parent_comment TEXT;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS coach_feedback TEXT;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE homework_assignment_participants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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

      ALTER TABLE points_log ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE points_log ADD COLUMN IF NOT EXISTS reference_id TEXT;

      UPDATE points_log pl
      SET date = COALESCE(hap.reviewed_at::date, hap.updated_at::date, CURRENT_DATE)
      FROM homework_assignment_participants hap
      WHERE pl.reason = 'homework'
      AND pl.date IS NULL
      AND pl.reference_id = 'homework_' || hap.id::text;

      UPDATE points_log
      SET date = CURRENT_DATE
      WHERE reason = 'homework'
      AND date IS NULL;

      ALTER TABLE payments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'subscription';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'cash';
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

      ALTER TABLE competitions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'competition';
      ALTER TABLE competitions ADD COLUMN IF NOT EXISTS result TEXT;
      ALTER TABLE competitions ADD COLUMN IF NOT EXISTS date DATE;

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

    await client.query(`
      UPDATE participants
      SET belt = REGEXP_REPLACE(belt, '\\s+з(і)?\\s+(синьою|жовтою|зеленою|коричневою|золотою|чорною)\\s+смужкою', ' зі сріблястою смужкою', 'gi')
      WHERE belt ~* '\\s+з(і)?\\s+(синьою|жовтою|зеленою|коричневою|золотою|чорною)\\s+смужкою';

      UPDATE participants
      SET belt = REGEXP_REPLACE(belt, '\\s+зі\\s+смужкою', ' зі сріблястою смужкою', 'gi')
      WHERE belt ~* '\\s+зі\\s+смужкою';
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

  const normalizeLogin = (login: unknown) => String(login ?? '').trim();
  const isMaskedPassword = (value: unknown) =>
    typeof value === 'string' && /^\*+$/.test(value.trim());
  const findBlockingPrimaryCredential = async (login: string, participantId: number) => {
    const normalizedPhone = normalizePhone(login);
    const phoneWithoutPlus = normalizedPhone.replace(/^\+/, '');
    const params: any[] = [login, participantId];
    const conditions = ["(id != $2 AND LOWER(TRIM(COALESCE(parent_login, ''))) = LOWER(TRIM($1)))"];

    if (normalizedPhone.length >= 7) {
      params.push(normalizedPhone);
      conditions.push(`(
        (id != $2 AND REGEXP_REPLACE(COALESCE(parent_login, ''), '[^\\d+]', '', 'g') LIKE '%' || $${params.length})
        OR (id != $2 AND REGEXP_REPLACE(COALESCE(parent_phone, ''), '[^\\d+]', '', 'g') LIKE '%' || $${params.length})
        OR (id != $2 AND REGEXP_REPLACE(COALESCE(phone, ''), '[^\\d+]', '', 'g') LIKE '%' || $${params.length})
      )`);

      params.push(phoneWithoutPlus);
      conditions.push(`(
        (id != $2 AND REGEXP_REPLACE(COALESCE(parent_login, ''), '[^\\d]', '', 'g') LIKE '%' || $${params.length})
        OR (id != $2 AND REGEXP_REPLACE(COALESCE(parent_phone, ''), '[^\\d]', '', 'g') LIKE '%' || $${params.length})
        OR (id != $2 AND REGEXP_REPLACE(COALESCE(phone, ''), '[^\\d]', '', 'g') LIKE '%' || $${params.length})
      )`);
    }

    const result = await pool.query(
      `SELECT id, name FROM participants WHERE ${conditions.join(' OR ')} LIMIT 1`,
      params
    );
    return result.rows[0] || null;
  };

  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: 'bb.sid',
    cookie: {
      secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  }));

  const configuredAllowedOrigins = new Set(
    [
      process.env.APP_URL,
      'https://shin-karate.kyiv.ua',
      'https://www.shin-karate.kyiv.ua',
      ...(process.env.ALLOWED_ORIGINS || '').split(',')
    ]
      .filter(Boolean)
      .map((origin) => String(origin).trim().replace(/\/$/, ''))
      .filter(Boolean)
  );

  const isTrustedOrigin = (origin: string, req: express.Request) => {
    try {
      const parsedOrigin = new URL(origin);
      const normalizedOrigin = parsedOrigin.origin.replace(/\/$/, '');
      if (configuredAllowedOrigins.has(normalizedOrigin)) return true;

      const requestHost = req.get('host')?.toLowerCase();
      if (requestHost && parsedOrigin.host.toLowerCase() === requestHost) return true;

      if (process.env.VERCEL_URL && parsedOrigin.host.toLowerCase() === process.env.VERCEL_URL.toLowerCase()) {
        return true;
      }

      return ['localhost', '127.0.0.1', '::1'].includes(parsedOrigin.hostname);
    } catch {
      return false;
    }
  };

  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.headers.origin;
    if (!origin) return next();
    if (Array.isArray(origin) || !isTrustedOrigin(origin, req)) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }
    next();
  });

  const ADMIN_TOKEN = crypto.createHash('sha256').update(SESSION_SECRET + 'admin-token-v1').digest('hex');

  const setFreshSession = (req: express.Request, values: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      req.session.regenerate((regenerateError) => {
        if (regenerateError) return reject(regenerateError);
        Object.assign(req.session as any, values);
        req.session.save((saveError) => saveError ? reject(saveError) : resolve());
      });
    });

  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${ADMIN_TOKEN}`) {
      (req as any).user = { role: 'admin', login: 'system' };
      return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const tokenPayload = verifyAuthToken(authHeader.slice('Bearer '.length));
      try {
        if (tokenPayload?.role === 'parent') {
          const result = await pool.query("SELECT id, name, 'parent' as role FROM participants WHERE id::text = $1", [tokenPayload.sub]);
          if (result.rows.length > 0) {
            (req as any).user = result.rows[0];
            return next();
          }
        } else if (tokenPayload) {
          const result = await pool.query("SELECT * FROM admin_users WHERE id::text = $1", [tokenPayload.sub]);
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

    // Also check session for admin
    if ((req.session as any).userId) {
      try {
        const result = await pool.query("SELECT * FROM admin_users WHERE id::text = $1", [(req.session as any).userId]);
        if (result.rows.length > 0) {
          (req as any).user = result.rows[0];
          return next();
        }
      } catch (e) {
        console.error('Session auth error:', e);
      }
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

  const getParentParticipantId = async (req: express.Request): Promise<number | null> => {
    const sessionParticipantId = (req.session as any).participantId;
    if (sessionParticipantId) {
      const parsed = Number(sessionParticipantId);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;

    const tokenPayload = verifyAuthToken(authHeader.slice('Bearer '.length));
    if (tokenPayload?.role !== 'parent') return null;

    try {
      const result = await pool.query("SELECT id FROM participants WHERE id = $1", [Number(tokenPayload.sub)]);
      return result.rows[0]?.id ?? null;
    } catch (e) {
      console.error('Parent token auth error:', e);
      return null;
    }
  };

  const getParentFamilyParticipantIds = async (participantId: number): Promise<number[]> => {
    const meRes = await pool.query(
      "SELECT parent_login, parent_phone, phone FROM participants WHERE id = $1",
      [participantId]
    );
    if (meRes.rows.length === 0) return [];

    const { parent_login, parent_phone, phone } = meRes.rows[0];
    const accessRes = await pool.query(
      "SELECT login, phone FROM participant_accesses WHERE participant_id = $1 AND can_login = TRUE",
      [participantId]
    );

    const loginIdentifiers = new Set<string>();
    const phoneIdentifiers = new Set<string>();

    const addLogin = (value: unknown) => {
      const normalized = normalizeLogin(value);
      if (normalized) {
        loginIdentifiers.add(normalized.toLowerCase());
      }
    };

    const addPhone = (value: unknown) => {
      const normalizedPhone = normalizePhone(String(value || '')).replace(/\D/g, '');
      if (normalizedPhone) {
        phoneIdentifiers.add(normalizedPhone);
      }
    };

    addLogin(parent_login);
    addPhone(parent_phone);
    addPhone(phone);
    accessRes.rows.forEach((access: any) => {
      addLogin(access.login);
      addPhone(access.phone);
      addPhone(access.login);
    });

    const loginParams = Array.from(loginIdentifiers);
    const phoneParams = Array.from(phoneIdentifiers);

    const queryParams: any[] = [participantId];
    const clauses: string[] = [];

    if (loginParams.length > 0) {
      queryParams.push(loginParams);
      clauses.push(`
        (
          LOWER(TRIM(COALESCE(p.parent_login, ''))) = ANY($${queryParams.length}::text[])
          OR EXISTS (
            SELECT 1
            FROM participant_accesses pa
            WHERE pa.participant_id = p.id
              AND LOWER(TRIM(COALESCE(pa.login, ''))) = ANY($${queryParams.length}::text[])
          )
        )
      `);
    }

    if (phoneParams.length > 0) {
      queryParams.push(phoneParams);
      clauses.push(`
        (
          REGEXP_REPLACE(COALESCE(p.parent_phone, ''), '[^\\d]', '', 'g') = ANY($${queryParams.length}::text[])
          OR REGEXP_REPLACE(COALESCE(p.phone, ''), '[^\\d]', '', 'g') = ANY($${queryParams.length}::text[])
          OR REGEXP_REPLACE(COALESCE(p.parent_login, ''), '[^\\d]', '', 'g') = ANY($${queryParams.length}::text[])
          OR EXISTS (
            SELECT 1
            FROM participant_accesses pa
            WHERE pa.participant_id = p.id
              AND (
                REGEXP_REPLACE(COALESCE(pa.phone, ''), '[^\\d]', '', 'g') = ANY($${queryParams.length}::text[])
                OR REGEXP_REPLACE(COALESCE(pa.login, ''), '[^\\d]', '', 'g') = ANY($${queryParams.length}::text[])
              )
          )
        )
      `);
    }

    const whereClause = clauses.length > 0
      ? `SELECT DISTINCT p.id FROM participants p WHERE p.id = $1 OR (${clauses.join(' OR ')})`
      : `SELECT DISTINCT p.id FROM participants p WHERE p.id = $1`;

    const result = await pool.query(whereClause, queryParams);
    return result.rows.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id));
  };

  const canAccessParticipant = async (user: any, participantId: any): Promise<boolean> => {
    const id = Number(participantId);
    if (!Number.isFinite(id)) return false;
    if (!user || user.role === 'admin') return true;
    if (user.role === 'coach') {
      if (!user.coach_id) return false;
      const result = await pool.query(`
        SELECT p.id
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.id = $1 AND g.coach_id = $2
        LIMIT 1
      `, [id, user.coach_id]);
      return result.rows.length > 0;
    }
    if (user.role === 'parent') {
      const familyIds = await getParentFamilyParticipantIds(user.id);
      return familyIds.includes(id);
    }
    return false;
  };

  const canAccessGroup = async (user: any, groupId: any): Promise<boolean> => {
    const id = Number(groupId);
    if (!Number.isFinite(id)) return false;
    if (!user || user.role === 'admin') return true;
    if (user.role !== 'coach' || !user.coach_id) return false;

    const result = await pool.query(
      "SELECT id FROM groups WHERE id = $1 AND coach_id = $2 LIMIT 1",
      [id, user.coach_id]
    );
    return result.rows.length > 0;
  };

  const normalizeHomeworkExercises = (exercises: any) => {
    const source = Array.isArray(exercises) ? exercises : [];
    return source
      .map((item: any, index: number) => ({
        id: String(item?.id || `ex_${index + 1}`),
        name: String(item?.name || '').trim(),
        target: String(item?.target || '').trim(),
        sets: Number.isFinite(Number(item?.sets)) ? Math.max(1, Math.min(20, Number(item.sets))) : 1,
        reps: String(item?.reps || '').trim(),
        rest: String(item?.rest || '').trim(),
        note: String(item?.note || '').trim()
      }))
      .filter((item: any) => item.name && item.target);
  };

  const ensureNotificationReferenceColumns = async (db: any) => {
    await db.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type TEXT");
    await db.query("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT");
  };

  const homeworkBlocks: Record<string, any[]> = {
    technique: [
      { name: 'Стійка + прямий удар', target: 'Зенкуцу-дачі, оі-цукі, повернення в захист', sets: 3, reps: '10 разів на кожну сторону', rest: '30 сек', note: 'Не гнати швидкість. Спочатку рівна спина і стабільні стопи.' },
      { name: 'Блоки перед дзеркалом', target: 'Джодан-уке, гедан-барай, чудан сото-уке', sets: 3, reps: '8 повторів кожного блоку', rest: '30 сек', note: 'Після кожного блоку рука повертається в захист.' },
      { name: 'Комбінація 1-2', target: 'Оі-цукі + гяку-цукі з видихом', sets: 4, reps: '12 комбінацій', rest: '40 сек', note: 'Видих на кожен удар, плечі не піднімати.' }
    ],
    kata: [
      { name: 'Ката по рахунку', target: 'Повільне проходження ката без поспіху', sets: 3, reps: '1 ката', rest: '60 сек', note: 'Після кожного проходу назвати 1 місце, яке треба покращити.' },
      { name: 'Перші 6 рухів', target: 'Чистота стійок і поворотів', sets: 5, reps: '6 рухів', rest: '30 сек', note: 'Працюємо якість, не швидкість.' },
      { name: 'Фініш ката', target: 'Останні рухи + повернення в йой', sets: 4, reps: '1 фрагмент', rest: '30 сек', note: 'Фініш має бути спокійним і зібраним.' }
    ],
    conditioning: [
      { name: 'База корпусу', target: 'Прес, планка, контроль дихання', sets: 3, reps: '20 прес + 30 сек планка', rest: '45 сек', note: 'Спина рівна, без ривків.' },
      { name: 'Ноги каратиста', target: 'Присідання + випади', sets: 4, reps: '15 присідань + 8 випадів', rest: '60 сек', note: 'Коліна дивляться в напрямку стоп.' },
      { name: 'Кардіо Осу', target: 'Легкі стрибки + удари руками', sets: 5, reps: '45 сек роботи', rest: '30 сек', note: 'Темп рівний, не до виснаження.' }
    ],
    flexibility: [
      { name: 'Мобільність тазу', target: 'Підготовка до мае-гері і маваші-гері', sets: 3, reps: '40 сек на вправу', rest: '20 сек', note: 'Без болю, тільки контрольоване натягнення.' },
      { name: 'Нахили і шпагатна база', target: 'Задня поверхня стегна, пах, спина', sets: 3, reps: '60 сек', rest: '30 сек', note: 'Дихати спокійно, не пружинити.' },
      { name: 'Високий підйом коліна', target: 'Баланс і підготовка удару ногою', sets: 4, reps: '8 разів на ногу', rest: '30 сек', note: 'Корпус рівний, опорна стопа стабільна.' }
    ],
    discipline: [
      { name: 'Щоденник Осу', target: 'Короткий запис після тренування або домашньої роботи', sets: 1, reps: '3 речення', rest: 'без паузи', note: 'Що вийшло, що було важко, що повторити наступного разу.' },
      { name: 'Форма і пояс', target: 'Самостійно скласти догі та завʼязати пояс', sets: 3, reps: '1 раз', rest: '30 сек', note: 'Батьки тільки спостерігають, дитина робить сама.' },
      { name: 'Команди японською', target: 'Осу, йой, хаджіме, яме, рей', sets: 2, reps: '5 команд', rest: '30 сек', note: 'Дитина каже команду і показує дію.' }
    ]
  };

  const homeworkFocusLabel = (focus: string) => {
    if (focus === 'kata') return 'ката';
    if (focus === 'conditioning') return 'фізичну підготовку';
    if (focus === 'flexibility') return 'гнучкість';
    if (focus === 'discipline') return 'дисципліну';
    return 'техніку';
  };

  const generateHomeworkSuggestions = (params: any) => {
    const focus = String(params?.focus || 'technique');
    const difficulty = String(params?.difficulty || 'medium');
    const minutes = Math.max(8, Math.min(45, Number(params?.estimated_minutes) || 15));
    const source = homeworkBlocks[focus] || homeworkBlocks.technique;
    const intensityLabel = difficulty === 'easy' ? 'легкий' : difficulty === 'hard' ? 'сильний' : 'збалансований';

    return [0, 1, 2].map((offset) => {
      const exercises = [0, 1, 2].map((step) => {
        const base = source[(offset + step) % source.length];
        const setBonus = difficulty === 'hard' ? 1 : difficulty === 'easy' ? -1 : 0;
        return {
          ...base,
          id: `${focus}_${offset}_${step}`,
          sets: Math.max(1, Number(base.sets || 1) + setBonus)
        };
      });

      return {
        title: `${offset === 0 ? 'База' : offset === 1 ? 'Контроль' : 'Виклик'}: ${homeworkFocusLabel(focus)}`,
        description: `Домашнє завдання на ${minutes} хв: ${intensityLabel} темп, контроль техніки і короткий запис у щоденнику після виконання.`,
        focus,
        difficulty,
        estimated_minutes: minutes,
        exercises,
        coach_note: offset === 0
          ? 'Добре для всієї групи після звичайного тренування.'
          : offset === 1
            ? 'Підійде перед атестацією або після пропусків.'
            : 'Для мотивованих учнів, які нормально тримають техніку.'
      };
    });
  };

  // Instagram OAuth Routes
  app.get('/api/auth/instagram/url', (req, res) => {
    const clientId = process.env.INSTAGRAM_CLIENT_ID;
    if (!clientId) return res.status(500).json({ error: "Instagram Client ID not configured" });

    const { action } = req.query; // 'login' or 'connect'
    const host = process.env.APP_URL ? new URL(process.env.APP_URL).host : req.get('host');
    const protocol = process.env.APP_URL ? new URL(process.env.APP_URL).protocol.replace(':', '') : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/instagram/callback`;

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
    const host = process.env.APP_URL ? new URL(process.env.APP_URL).host : req.get('host');
    const protocol = process.env.APP_URL ? new URL(process.env.APP_URL).protocol.replace(':', '') : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/instagram/callback`;

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
        const role = (user.role === 'coach' ? 'coach' : 'admin') as AuthTokenRole;
        await setFreshSession(req, {
          userId: user.id,
          role,
          userName: user.name
        });

        return res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'instagram_login_success', user: ${JSON.stringify({
                    role,
                    name: user.name,
                    token: createAuthToken({ id: user.id, role })
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

  async function notifyParent(participantId: number, type: string, message: string, coachName?: string, skipAdminLog: boolean = false) {
    if (!pool) return;
    try {
      // 1. Fetch participant info
      const pRes = await pool.query("SELECT telegram_chat_id, name FROM participants WHERE id = $1", [participantId]);
      const participant = pRes.rows[0];
      if (!participant) return;

      // 2. Save to DB
      await pool.query(
        "INSERT INTO notifications (participant_id, type, message) VALUES ($1, $2, $3)",
        [participantId, type, message]
      );

      // 3. Send to Parent Telegram only for direct, intentional messages.
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const parentTelegramTypes = new Set(['manual', 'message', 'announcement']);
      if (token && participant.telegram_chat_id && parentTelegramTypes.has(type)) {
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

      // 4. Optional admin audit channel. Disabled by default to avoid Telegram noise.
      if (!skipAdminLog && process.env.TELEGRAM_ADMIN_AUDIT_ENABLED === 'true') {
        const coachInfo = coachName ? `\n👤 Виконав: ${coachName}` : '';
        const adminText = `📢 <b>СИСТЕМА СПОВІЩЕНЬ</b>\n\n👤 Учень: <b>${participant.name}</b>\n📝 Тип: ${type}\n💬 Повідомлення: ${message}${coachInfo}`;
        await sendTelegramMessage(adminText);
      }

    } catch (e) {
      console.error('Failed to notify parent:', e);
    }
  }

  async function logAuditAction(userId: number, role: string, action: string, type: string, entityId?: number, details?: any) {
    if (!pool) return;
    try {
      await pool.query(
        "INSERT INTO audit_logs (user_id, user_role, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)",
        [userId, role, action, type, entityId || null, details ? JSON.stringify(details) : null]
      );
    } catch (e) {
      console.error('Failed to log audit action:', e);
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
            const participantRes = await pool.query("SELECT parent_login FROM participants WHERE id = $1", [id]);
            const parentLogin = participantRes.rows[0]?.parent_login;
            if (parentLogin) {
              await pool.query("UPDATE participants SET telegram_chat_id = $1 WHERE parent_login = $2", [chatId, parentLogin]);
            } else {
              await pool.query("UPDATE participants SET telegram_chat_id = $1 WHERE id = $2", [chatId, id]);
            }
          } else if (type === "c") {
            await pool.query("UPDATE coaches SET telegram_chat_id = $1 WHERE id = $2", [chatId, id]);
          }
        } catch (e) {
          console.error("Telegram connection error:", e);
        }
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
        return false;
      }
      return true;
    } catch (e) {
      console.error('Failed to send Telegram message:', e);
      return false;
    }
  }

  const escapeTelegramHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  async function sendMonthlyClubSummary(label: string) {
    if (!pool) return;

    const [debtorsRes, absenceRes] = await Promise.all([
      pool.query(`
        SELECT p.name, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.status = 'active'
        AND COALESCE(p.payment_status, 'unpaid') != 'paid'
        ORDER BY g.name NULLS LAST, p.name ASC
        LIMIT 40
      `),
      pool.query(`
        SELECT
          p.name,
          g.name as group_name,
          COUNT(a.id) FILTER (
            WHERE a.status = 'absent'
            AND a.date >= CURRENT_DATE - INTERVAL '30 days'
          )::int as absent_count,
          COALESCE(
            CURRENT_DATE - MAX(a.date) FILTER (WHERE a.status = 'present'),
            999
          )::int as days_since_last
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        LEFT JOIN attendance a ON p.id = a.participant_id
        WHERE p.status = 'active'
        GROUP BY p.id, p.name, g.name
        HAVING
          COUNT(a.id) FILTER (
            WHERE a.status = 'absent'
            AND a.date >= CURRENT_DATE - INTERVAL '30 days'
          ) >= 3
          OR COALESCE(
            CURRENT_DATE - MAX(a.date) FILTER (WHERE a.status = 'present'),
            999
          ) >= 14
        ORDER BY absent_count DESC, days_since_last DESC, p.name ASC
        LIMIT 40
      `)
    ]);

    const debtors = debtorsRes.rows;
    const absenceRisk = absenceRes.rows;

    if (debtors.length === 0 && absenceRisk.length === 0) {
      console.log(`${label} club summary skipped: no debtors or absence risks.`);
      return;
    }

    let message = `<b>📌 ${escapeTelegramHtml(label)}: важливе по клубу</b>\n\n`;

    if (debtors.length > 0) {
      message += `<b>💳 Боржники (${debtors.length})</b>\n`;
      debtors.slice(0, 20).forEach((p: any) => {
        message += `• ${escapeTelegramHtml(p.name)}${p.group_name ? ` — ${escapeTelegramHtml(p.group_name)}` : ''}\n`;
      });
      if (debtors.length > 20) message += `• +${debtors.length - 20} ще\n`;
      message += `\n`;
    }

    if (absenceRisk.length > 0) {
      message += `<b>⚠️ Багато прогулів / давно не були (${absenceRisk.length})</b>\n`;
      absenceRisk.slice(0, 20).forEach((p: any) => {
        const daysText = Number(p.days_since_last) >= 999 ? 'не було відміток' : `${p.days_since_last} дн. без присутності`;
        message += `• ${escapeTelegramHtml(p.name)}${p.group_name ? ` — ${escapeTelegramHtml(p.group_name)}` : ''}: ${p.absent_count || 0} пропусків, ${daysText}\n`;
      });
      if (absenceRisk.length > 20) message += `• +${absenceRisk.length - 20} ще\n`;
    }

    await sendTelegramMessage(message);
  }

  const isLastDayOfMonth = (date = new Date()) => {
    const tomorrow = new Date(date);
    tomorrow.setDate(date.getDate() + 1);
    return tomorrow.getMonth() !== date.getMonth();
  };

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
    const user = (req as any).user;
    try {
      // Limit to 100 most recent leads to save bandwidth/quota
      let query = "SELECT * FROM leads";
      const params: any[] = [];

      if (user.role === 'coach' && user.coach_id) {
        query += " WHERE assigned_coach_id = $1";
        params.push(user.coach_id);
      }

      query += " ORDER BY created_at DESC LIMIT 100";
      const result = await pool.query(query, params);
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

  // Helper to normalize date to YYYY-MM-DD
  function normalizeDate(dateStr: any) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    const s = dateStr.toString().trim();
    if (!s) return new Date().toISOString().split('T')[0];

    // Check for DD.MM.YYYY
    if (s.includes('.') && s.split('.').length === 3) {
      const parts = s.split('.');
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    // Check for YYYY-MM-DD
    if (s.includes('-') && s.split('-').length === 3) {
      return s;
    }

    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}

    return new Date().toISOString().split('T')[0];
  }

  app.post("/api/attendance/bulk", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participants, date, status } = req.body;

    if (!Array.isArray(participants) || !date || !status) {
      return res.status(400).json({ error: "Invalid bulk data" });
    }

    const participantIds = participants
      .map((participant: any) => Number(typeof participant === 'object' ? participant.id ?? participant.participant_id : participant))
      .filter((id: number) => Number.isInteger(id) && id > 0);

    if (participantIds.length !== participants.length || participantIds.length === 0) {
      return res.status(400).json({ error: "Invalid participant IDs" });
    }

    const normalizedDate = normalizeDate(date);
    const user = (req as any).user;
    const coachId = user?.id || null;
    const userRole = user?.role || 'coach';

    try {
      if (user?.role === 'coach' && user.coach_id) {
        const scopeResult = await pool.query(
          `SELECT COUNT(DISTINCT p.id)::int AS count
           FROM participants p
           LEFT JOIN groups g ON p.group_id = g.id
           WHERE p.id = ANY($1::int[]) AND g.coach_id = $2`,
          [participantIds, user.coach_id]
        );
        if (scopeResult.rows[0]?.count !== participantIds.length) {
          return res.status(403).json({ error: "Forbidden" });
        }
      } else {
        const existsResult = await pool.query(
          "SELECT COUNT(DISTINCT id)::int AS count FROM participants WHERE id = ANY($1::int[])",
          [participantIds]
        );
        if (existsResult.rows[0]?.count !== participantIds.length) {
          return res.status(404).json({ error: "Participant not found" });
        }
      }

      await pool.query("BEGIN");

      const results = [];
      for (const pId of participantIds) {
        // Find current streak to update
        const pInfo = await pool.query("SELECT streak, last_attendance_date FROM participants WHERE id = $1", [pId]);
        const p = pInfo.rows[0];
        const existing = await pool.query(
          "SELECT status FROM attendance WHERE participant_id = $1 AND date = $2",
          [pId, normalizedDate]
        );
        const previousStatus = existing.rows[0]?.status;

        let newStreak = (p?.streak || 0);
        if (status === 'present') {
          const yesterday = new Date(normalizedDate);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (p?.last_attendance_date && p.last_attendance_date.toISOString().split('T')[0] === yesterdayStr) {
            newStreak += 1;
          } else if (!p?.last_attendance_date || p.last_attendance_date.toISOString().split('T')[0] < yesterdayStr) {
            newStreak = 1;
          }
        } else if (status === 'absent') {
          newStreak = 0;
        }

        await pool.query(
          `INSERT INTO attendance (participant_id, date, status, coach_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (participant_id, date) DO UPDATE SET status = EXCLUDED.status, coach_id = EXCLUDED.coach_id`,
          [pId, normalizedDate, status, coachId]
        );

        if (status === 'present' && previousStatus !== 'present') {
           // Increment rank points and streak
           await pool.query(
            "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
            [pId, 1, 'attendance', normalizedDate]
          );

          await pool.query(
            "UPDATE participants SET rank_points = rank_points + 1, streak = $1, last_attendance_date = $2 WHERE id = $3",
            [newStreak, normalizedDate, pId]
          );
        } else if (status === 'absent' && previousStatus === 'present') {
          await pool.query(
            "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
            [pId, -1, 'attendance_removal', normalizedDate]
          );
          await pool.query("UPDATE participants SET rank_points = GREATEST(0, rank_points - 1), streak = 0 WHERE id = $1", [pId]);
        } else if (status === 'absent') {
          await pool.query("UPDATE participants SET streak = 0 WHERE id = $1", [pId]);
        }

        results.push(pId);
      }

      await pool.query("COMMIT");

      logAuditAction(coachId, userRole, `Масова відмітка: ${status} (${participantIds.length} учнів)`, 'attendance', null, { date: normalizedDate, count: participantIds.length });

      res.json({ success: true, count: results.length });
    } catch (e) {
      await pool.query("ROLLBACK");
      console.error("Bulk attendance failed:", e);
      res.status(500).json({ error: "Failed to update bulk attendance" });
    }
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

      // Send notifications (Synchronous for stability)
      try {
        const tgStatus = await sendTelegramMessage(message);
        console.log(`Telegram notification status: ${tgStatus ? 'Success' : 'Failed'}`);

        // 2. Send to Meta Pixel (Background is fine for this)
        sendMetaEvent('Lead', { name, phone, event_id, source }, req).catch(err => console.error('Meta CAPI error:', err));

        res.json({ success: true, telegramSent: !!tgStatus });
      } catch (notifyErr) {
        console.error('Notification logic error:', notifyErr);
        // Still return success if DB save worked but notification failed
        res.json({ success: true, telegramSent: false, warning: 'Notification failed' });
      }
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

      console.log('Weekly attendance report prepared; Telegram delivery disabled to keep the bot quiet.');
    } catch (err) {
      console.error('Failed to send weekly report:', err);
    }
  });

  // Monthly Payment Reminder - Every 1st of the month at 09:00
  cron.schedule('0 9 1 * *', async () => {
    console.log('Running start-of-month club summary...');
    try {
      await sendMonthlyClubSummary('Початок місяця');
    } catch (err) {
      console.error('Failed to send start-of-month club summary:', err);
    }
  });

  // End-of-month summary - Last day of each month at 09:00
  cron.schedule('0 9 * * *', async () => {
    if (!isLastDayOfMonth()) return;
    console.log('Running end-of-month club summary...');
    try {
      await sendMonthlyClubSummary('Кінець місяця');
    } catch (err) {
      console.error('Failed to send end-of-month club summary:', err);
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

      console.log('Birthday notifications prepared; Telegram delivery disabled to keep the bot quiet.');
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
    const { name, phone, age_group, location, status, value, assigned_coach_id, converted_participant_id } = req.body;
    try {
      await pool.query(
        `UPDATE leads
         SET name = $1,
             phone = $2,
             age_group = $3,
             location = $4,
             status = $5,
             value = $6,
             assigned_coach_id = $7,
             converted_participant_id = $8
         WHERE id = $9`,
        [
          name,
          phone,
          age_group,
          location,
          status,
          value === '' || value === undefined ? 0 : value,
          assigned_coach_id || null,
          converted_participant_id || null,
          req.params.id
        ]
      );
      res.json({ success: true });
    } catch (e) {
      console.error("Failed to update lead:", e);
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
  const MAX_IMAGE_UPLOAD_BYTES = Number(process.env.MAX_IMAGE_UPLOAD_BYTES || 6 * 1024 * 1024);
  const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

  const parseSafeImageData = (image: unknown) => {
    if (typeof image !== 'string' || !image.startsWith('data:image/')) return null;
    const matches = image.match(/^data:([A-Za-z0-9.+/-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!matches || matches.length !== 3) return null;

    const contentType = matches[1].toLowerCase();
    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) return null;

    const base64Payload = matches[2].replace(/\s/g, '');
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length || buffer.length > MAX_IMAGE_UPLOAD_BYTES) return null;

    return {
      contentType,
      buffer,
      dataUrl: `data:${contentType};base64,${base64Payload}`
    };
  };

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

      const imageData = parseSafeImageData(result.rows[0].value);
      if (!imageData) {
        return res.status(400).send("Invalid image format");
      }

      // Update cache
      imageCache.set(cacheKey, { contentType: imageData.contentType, buffer: imageData.buffer, timestamp: Date.now() });

      res.setHeader('Content-Type', imageData.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
      res.send(imageData.buffer);
    } catch (e) {
      console.error(e);
      res.status(500).send("Internal server error");
    }
  });

  app.get("/api/images/coaches/:id", async (req, res) => {
    if (!pool) return res.status(500).send("Database not configured");
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).send("Invalid coach id");
    }
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

      const imageData = parseSafeImageData(result.rows[0].photo);
      if (!imageData) {
        return res.status(400).send("Invalid image format");
      }

      // Update cache
      imageCache.set(cacheKey, { contentType: imageData.contentType, buffer: imageData.buffer, timestamp: Date.now() });

      res.setHeader('Content-Type', imageData.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year cache
      res.send(imageData.buffer);
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
      const loginValue = normalizeLogin(login);
      if (!loginValue || !password) {
        return res.status(400).json({ error: 'Login and password required' });
      }

      // Нормалізуємо телефон (видаляємо всі non-digits) для пошуку
      const normalizedPhone = normalizePhone(loginValue);
      const phoneWithoutPlus = normalizedPhone.replace(/^\+/, '');
      console.log('Normalized phone for login:', normalizedPhone);

      if (!pool) return res.status(500).json({ error: 'Database not configured' });

      // Пошук батька по логіну або телефону (в participants таблиці)
      let user = null;
      const result = await pool.query(
        `SELECT id, name, phone, parent_phone, parent_password, parent_login
         FROM participants
         WHERE LOWER(TRIM(parent_login)) = LOWER($1)
         ORDER BY id ASC
         LIMIT 1`,
        [loginValue]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
        console.log('Found parent by primary login:', user.id);
      }

      // Якщо батька не знайдено - перевіримо адмінів
      if (!user) {
        const accessConditions = ["LOWER(TRIM(pa.login)) = LOWER($1)"];
        const accessParams: any[] = [loginValue];

        if (normalizedPhone.length >= 7) {
          accessParams.push(normalizedPhone);
          accessConditions.push(`REGEXP_REPLACE(COALESCE(pa.phone, ''), '[^\\d+]', '', 'g') LIKE '%' || $${accessParams.length}`);

          accessParams.push(phoneWithoutPlus);
          accessConditions.push(`REGEXP_REPLACE(COALESCE(pa.phone, ''), '[^\\d]', '', 'g') LIKE '%' || $${accessParams.length}`);
          accessConditions.push(`REGEXP_REPLACE(COALESCE(pa.login, ''), '[^\\d]', '', 'g') LIKE '%' || $${accessParams.length}`);
        }

        const accessResult = await pool.query(
          `SELECT p.id, p.name, p.phone, p.parent_phone, p.parent_login,
                  pa.password_hash as parent_password,
                  pa.id as access_id,
                  pa.name as access_name,
                  pa.access_type
           FROM participant_accesses pa
           JOIN participants p ON p.id = pa.participant_id
           WHERE pa.can_login = TRUE
           AND (${accessConditions.join(' OR ')})
           ORDER BY pa.id ASC
           LIMIT 1`,
          accessParams
        );

        if (accessResult.rows.length > 0) {
          user = accessResult.rows[0];
          console.log('Found family access for participant:', user.id);
        }
      }

      if (!user && normalizedPhone.length >= 7) {
        const phoneResult = await pool.query(
          `SELECT id, name, phone, parent_phone, parent_password, parent_login
           FROM participants
           WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^\\d+]', '', 'g') LIKE '%' || $1
              OR REGEXP_REPLACE(COALESCE(parent_phone, ''), '[^\\d+]', '', 'g') LIKE '%' || $1
              OR REGEXP_REPLACE(COALESCE(phone, ''), '[^\\d]', '', 'g') LIKE '%' || $2
              OR REGEXP_REPLACE(COALESCE(parent_phone, ''), '[^\\d]', '', 'g') LIKE '%' || $2
           ORDER BY id ASC
           LIMIT 1`,
          [normalizedPhone, phoneWithoutPlus]
        );

        if (phoneResult.rows.length > 0) {
          user = phoneResult.rows[0];
          console.log('Found parent by phone fallback:', user.id);
        }
      }

      if (!user) {
        const adminResult = await pool.query(
          `SELECT id, name, password as admin_password, role FROM admin_users WHERE login = $1 LIMIT 1`,
          [loginValue]
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
            if (isBcryptHash(user.parent_password)) {
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
        await setFreshSession(req, {
          userId: user.id,
          participantId: user.id,
          parentAccessId: user.access_id || null,
          parentAccessType: user.access_type || 'primary',
          role: 'parent',
          userName: user.access_name || user.name
        });

        return res.json({
          success: true,
          role: 'parent',
          name: user.access_name || user.name,
          participantId: user.id,
          token: createAuthToken({ id: user.id, role: 'parent', accessId: user.access_id || null }),
          redirect: '/parent'
        });
      }

      // ===== АДМІН LOGIN =====
      else {
        let passwordMatch = false;

        try {
          if (isBcryptHash(user.admin_password)) {
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
        const role = (user.role === 'coach' ? 'coach' : 'admin') as AuthTokenRole;
        await setFreshSession(req, {
          userId: user.id,
          role,
          userName: user.name
        });

        return res.json({
          success: true,
          role,
          name: user.name,
          id: user.id,
          token: createAuthToken({ id: user.id, role }),
          redirect: '/admin'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error: ' + (error as any).message });
    }
  };

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    validate: false
  });

  app.post('/api/login', authLimiter, loginHandler);
  app.post('/api/auth/login', authLimiter, loginHandler);

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
    if (!pool) return res.status(500).json({ error: "Database not configured" });

    const user = (req as any).user;
    if (!user?.id || user.role === 'parent') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
      const result = await pool.query("SELECT password FROM admin_users WHERE id = $1 LIMIT 1", [user.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const storedPassword = result.rows[0].password;
      const passwordMatches = isBcryptHash(storedPassword)
        ? await bcrypt.compare(currentPassword, storedPassword)
        : currentPassword === storedPassword;

      if (!passwordMatches) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(String(newPassword), 10);
      await pool.query("UPDATE admin_users SET password = $1 WHERE id = $2", [hashedPassword, user.id]);
      res.json({ success: true });
    } catch (e) {
      console.error('Password change failed:', e);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  app.get("/api/participants/export", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query(`
        SELECT p.id, p.name, p.member_type, p.age, p.birthday, p.email, p.belt, p.rank_points, p.payment_status, p.status, p.parent_name, p.phone, p.parent_phone, p.parent_login, p.telegram_chat_id, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        ORDER BY p.name ASC
      `);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Participants");
      const rows = result.rows;
      const columns = Object.keys(rows[0] || {
        id: '',
        name: '',
        member_type: '',
        age: '',
        birthday: '',
        email: '',
        belt: '',
        rank_points: '',
        payment_status: '',
        status: '',
        parent_name: '',
        phone: '',
        parent_phone: '',
        parent_login: '',
        telegram_chat_id: '',
        group_name: ''
      });

      worksheet.columns = columns.map((key) => ({
        header: key,
        key,
        width: Math.min(32, Math.max(12, key.length + 4))
      }));
      rows.forEach((row: any) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=participants.xlsx');
      res.send(Buffer.from(buffer as ArrayBuffer));
    } catch (e) {
      console.error('Export failed:', e);
      res.status(500).json({ error: "Failed to export participants" });
    }
  });

  app.post("/api/register-member", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const {
      children,
      registration_type,
      parent_name,
      phone,
      parent_phone,
      parent_email,
      email,
      password,
      telegram_opt_in
    } = req.body;

    const registrationType = registration_type === 'adult' ? 'adult' : 'parent_child';
    const submittedMembers = Array.isArray(children) ? children : [];
    const membersToSave = registrationType === 'adult' ? submittedMembers.slice(0, 1) : submittedMembers;

    if (membersToSave.length === 0) {
      return res.status(400).json({ error: "No member data provided" });
    }

    const contactPhone = parent_phone || phone;
    const normalizedPhone = normalizePhone(contactPhone);
    const parent_login = normalizedPhone || `user_${Math.random().toString(36).substring(2, 8)}`;
    const rawPassword = password;
    const contactEmail = String(parent_email || email || '').trim().toLowerCase();

    if (!rawPassword) {
      return res.status(400).json({ error: "Password is required" });
    }

    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const hasMissingName = membersToSave.some((member: any) => {
      const memberName = String(member?.name || parent_name || '').trim();
      return !memberName;
    });

    if (hasMissingName) {
      return res.status(400).json({ error: "Member name is required" });
    }

    try {
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const results: number[] = [];

      for (const member of membersToSave) {
        const { age, birthday, group_id, belt } = member;
        const memberName = String(member.name || parent_name || '').trim();
        const storedParentName = registrationType === 'adult' ? memberName : parent_name;
        const storedPhone = registrationType === 'adult' ? contactPhone : (member.phone || phone || null);

        const result = await pool.query(
          "INSERT INTO participants (name, age, birthday, group_id, parent_name, phone, parent_phone, parent_login, parent_password, email, member_type, belt, payment_status, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id",
          [
            memberName,
            age || null,
            birthday || null,
            group_id || null,
            storedParentName,
            storedPhone,
            contactPhone,
            parent_login,
            hashedPassword,
            contactEmail,
            registrationType === 'adult' ? 'adult' : 'child',
            normalizeBeltName(belt),
            'unpaid',
            'new'
          ]
        );
        results.push(result.rows[0].id);
      }

      console.log('Member registration saved; Telegram delivery remains limited to important messages.');

      if (results.length > 0) {
        (req.session as any).participantId = results[0];
        return req.session.save((err) => {
          if (err) console.error('Session save error after registration:', err);
          const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'BlackBearDojoBot';
          res.json({
            success: true,
            count: membersToSave.length,
            login: parent_login,
            password: rawPassword,
            participantIds: results,
            telegramConnectUrl: telegram_opt_in ? `https://t.me/${botUsername}?start=p_${results[0]}` : null
          });
        });
      }

      res.json({
        success: true,
        count: membersToSave.length,
        login: parent_login,
        password: rawPassword,
        participantIds: results,
        telegramConnectUrl: null
      });
    } catch (e) {
      console.error('Registration failed:', e);
      res.status(500).json({ error: "Failed to register members" });
    }
  });

  app.post("/api/register-member-legacy", async (req, res) => {
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
          [name, age, birthday || null, group_id || null, parent_name, phone, contactPhone, parent_login, hashedPassword, normalizeBeltName(belt), 'unpaid', 'new']
        );
        results.push(result.rows[0].id);
      }

      console.log('Member registration saved; Telegram delivery disabled to keep the bot quiet.');

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
      const isHashed = isBcryptHash(p.parent_password);
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
  const MAX_IMPORT_FILE_BYTES = Number(process.env.MAX_IMPORT_FILE_BYTES || 5 * 1024 * 1024);
  const MAX_IMPORT_ROWS = Number(process.env.MAX_IMPORT_ROWS || 3000);
  const IMPORT_FILE_MIME_TYPES = new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]);

  const tableRowsToObjects = (rows: any[][]) => {
    const cleanRows = rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
    if (cleanRows.length === 0) return [];

    const headers = cleanRows[0].map((cell, index) => {
      const header = String(cell ?? '').replace(/^\ufeff/, '').trim();
      return header || `column_${index + 1}`;
    });

    return cleanRows.slice(1).map((row) => {
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? '';
      });
      return record;
    });
  };

  const parseCsvRecords = (text: string) => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inQuotes) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cell += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(cell);
        cell = '';
      } else if (char === '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else if (char !== '\r') {
        cell += char;
      }
    }

    row.push(cell);
    rows.push(row);
    return tableRowsToObjects(rows);
  };

  const normalizeExcelCellValue = (value: any) => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value !== 'object') return value;
    if (value.text !== undefined) return value.text;
    if (value.result !== undefined) return value.result;
    if (Array.isArray(value.richText)) {
      return value.richText.map((part: any) => part?.text || '').join('');
    }
    return String(value);
  };

  const worksheetToRecords = (worksheet?: ExcelJS.Worksheet) => {
    if (!worksheet) return [];
    const rows: any[][] = [];
    const columnCount = Math.min(Math.max(worksheet.columnCount || 0, 1), 80);

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values: any[] = [];
      for (let column = 1; column <= columnCount; column += 1) {
        values.push(normalizeExcelCellValue(row.getCell(column).value));
      }
      rows.push(values);
    });

    return tableRowsToObjects(rows);
  };

  const readImportRecordsFromBuffer = async (buffer: Buffer, originalName: string, mimeType = '') => {
    const isCsv = mimeType.includes('csv') || /\.csv$/i.test(originalName);
    if (isCsv) {
      return parseCsvRecords(buffer.toString('utf8'));
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    return worksheetToRecords(workbook.worksheets[0]);
  };

  const getSafeGoogleSheetCsvUrl = (sheetUrl: unknown) => {
    const rawUrl = String(sheetUrl || '').trim();
    if (!rawUrl) return null;

    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'docs.google.com') return null;
      const match = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) return null;

      const gid = parsed.searchParams.get('gid');
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ''}`;
    } catch {
      return null;
    }
  };

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMPORT_FILE_BYTES,
      files: 1
    },
    fileFilter: (_req, file, cb) => {
      const isAllowedExtension = /\.(csv|xlsx)$/i.test(file.originalname || '');
      const isAllowedMime = IMPORT_FILE_MIME_TYPES.has(file.mimetype);
      if (isAllowedExtension || isAllowedMime) return cb(null, true);
      cb(new Error('Only CSV and XLSX files are allowed'));
    }
  });

  const handleImportUpload: express.RequestHandler = (req, res, next) => {
    upload.single('file')(req, res, (error: any) => {
      if (!error) return next();
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: "Import file is too large" });
      }
      return res.status(400).json({ error: error.message || "Invalid import file" });
    });
  };

  app.post("/api/participants/import", requireAuth, handleImportUpload, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });

    let data: any[] = [];
    const { sheetUrl, group_id } = req.body;

    try {
      if (req.file) {
        data = await readImportRecordsFromBuffer(req.file.buffer, req.file.originalname || '', req.file.mimetype || '');
      } else if (sheetUrl) {
        const fetchUrl = getSafeGoogleSheetCsvUrl(sheetUrl);
        if (!fetchUrl) {
          return res.status(400).json({ error: "Only Google Sheets URLs are allowed" });
        }

        const response = await fetch(fetchUrl, { timeout: 10000, size: MAX_IMPORT_FILE_BYTES } as any);
        if (!response.ok) throw new Error('Failed to fetch Google Sheet');
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > MAX_IMPORT_FILE_BYTES) {
          return res.status(413).json({ error: "Google Sheet export is too large" });
        }
        const csvText = await response.text();
        if (Buffer.byteLength(csvText, 'utf8') > MAX_IMPORT_FILE_BYTES) {
          return res.status(413).json({ error: "Google Sheet export is too large" });
        }
        data = parseCsvRecords(csvText);
      } else {
        return res.status(400).json({ error: "No file or URL provided" });
      }

      if (data.length === 0) {
        return res.status(400).json({ error: "No data found in file or URL" });
      }

      if (data.length > MAX_IMPORT_ROWS) {
        return res.status(413).json({ error: `Import is limited to ${MAX_IMPORT_ROWS} rows` });
      }

      const normalizeImportKey = (value: any) =>
        String(value ?? '')
          .trim()
          .toLowerCase()
          .replace(/[^a-zа-яіїєґё0-9]+/gi, '');

      const isBlank = (value: any) => value === undefined || value === null || String(value).trim() === '';

      const cleanText = (value: any) => {
        if (isBlank(value)) return undefined;
        return String(value).trim();
      };

      const getRowValue = (row: Record<string, any>, aliases: string[]) => {
        const normalizedRow = new Map<string, any>();
        Object.entries(row).forEach(([key, value]) => {
          normalizedRow.set(normalizeImportKey(key), value);
        });

        for (const alias of aliases) {
          const value = normalizedRow.get(normalizeImportKey(alias));
          if (!isBlank(value)) return value;
        }
        return undefined;
      };

      const parseNumber = (value: any) => {
        if (isBlank(value)) return undefined;
        const parsed = parseInt(String(value).replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      const parseDateValue = (value: any) => {
        if (isBlank(value)) return undefined;

        if (typeof value === 'number') {
          const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
          if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
        }

        const raw = String(value).trim();
        const dotMatch = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (dotMatch) {
          return `${dotMatch[3]}-${dotMatch[2].padStart(2, '0')}-${dotMatch[1].padStart(2, '0')}`;
        }

        const dashMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (dashMatch) {
          return `${dashMatch[1]}-${dashMatch[2].padStart(2, '0')}-${dashMatch[3].padStart(2, '0')}`;
        }

        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }

        return undefined;
      };

      const calculateAge = (birthday?: string) => {
        if (!birthday) return undefined;
        const birthDate = new Date(birthday);
        if (isNaN(birthDate.getTime())) return undefined;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
        return age >= 0 ? age : undefined;
      };

      const normalizePaymentStatus = (value: any) => {
        if (isBlank(value)) return undefined;
        const normalized = normalizeImportKey(value);
        if (['paid', 'yes', 'true', '1', 'так', 'оплачено', 'сплачено'].includes(normalized)) return 'paid';
        if (['unpaid', 'no', 'false', '0', 'ні', 'борг', 'неоплачено', 'несплачено'].includes(normalized)) return 'unpaid';
        return cleanText(value);
      };

      const normalizeStatus = (value: any) => {
        if (isBlank(value)) return undefined;
        const normalized = normalizeImportKey(value);
        if (['active', 'активний', 'активна', 'активен'].includes(normalized)) return 'active';
        if (['new', 'новий', 'нова', 'новачок'].includes(normalized)) return 'new';
        if (['archived', 'archive', 'inactive', 'архів', 'архив', 'неактивний'].includes(normalized)) return 'archived';
        return cleanText(value);
      };

      const parseChecklist = (value: any) => {
        if (isBlank(value)) return undefined;
        if (Array.isArray(value)) return JSON.stringify(value);
        const raw = String(value).trim();
        try {
          const parsed = JSON.parse(raw);
          return JSON.stringify(parsed);
        } catch {
          return JSON.stringify(raw.split(',').map(item => item.trim()).filter(Boolean));
        }
      };

      const groupResult = await pool.query("SELECT id, name FROM groups");
      const groupLookup = new Map<string, number>();
      groupResult.rows.forEach((group: any) => {
        groupLookup.set(String(group.id), group.id);
        groupLookup.set(normalizeImportKey(group.name), group.id);
      });

      const selectedGroupId = parseNumber(group_id);
      const resolveGroupId = (value: any) => {
        if (selectedGroupId) return selectedGroupId;
        if (isBlank(value)) return undefined;
        const directId = parseNumber(value);
        if (directId) return directId;
        return groupLookup.get(normalizeImportKey(value));
      };

      const generatedParentPasswords = new Map<string, string>();
      const getImportParentPassword = (parentLogin: string, explicitPassword?: string) => {
        if (explicitPassword) return explicitPassword;
        if (!generatedParentPasswords.has(parentLogin)) {
          generatedParentPasswords.set(parentLogin, crypto.randomBytes(4).toString('hex'));
        }
        return generatedParentPasswords.get(parentLogin)!;
      };

      const participantsToImport = data.map((row, index) => {
        const birthday = parseDateValue(getRowValue(row, [
          'birthday', 'birth_date', 'birth date', 'date of birth', 'dob',
          'child_birth_date', 'child birth date', 'adult_birth_date',
          'дата народження', 'день народження', 'дн', 'дата рождения',
          'дата народження дитини', 'дата народження учасника'
        ]));
        const parentPhone = cleanText(getRowValue(row, [
          'parent_phone', 'parent phone', 'contact phone', 'contact', 'phone_number',
          'телефон', 'номер телефону', 'телефон батьків', 'телефон батька', 'телефон мами',
          'контакт', 'контактний телефон', 'phone', 'номер телефону батьків'
        ]));
        const childPhone = cleanText(getRowValue(row, [
          'child_phone', 'child phone', 'participant_phone', 'participant phone', 'student phone',
          'телефон дитини', 'телефон учня'
        ]));
        const explicitParentLogin = cleanText(getRowValue(row, [
          'parent_login', 'login', 'логін', 'логин', 'логін батьків', 'логін parent'
        ]));
        const normalizedParentPhone = normalizePhone(parentPhone || childPhone || '');
        const normalizedChildPhone = normalizePhone(childPhone || parentPhone || '');
        const phoneLogin = normalizedParentPhone || normalizedChildPhone;
        const parentLogin = explicitParentLogin || phoneLogin || `parent_${crypto.createHash('sha1').update(`${parentPhone || ''}|${childPhone || ''}|${index}`).digest('hex').slice(0, 10)}`;
        const explicitParentPassword = cleanText(getRowValue(row, [
          'parent_password', 'password', 'пароль', 'пароль батьків'
        ]));

        return {
          rowNumber: index + 2,
          name: cleanText(getRowValue(row, [
            'name', 'full_name', 'full name', 'participant_name', 'participant name',
            'student_name', 'student name', 'child_full_name', 'child full name',
            'child_name', 'child name', 'adult_full_name', 'adult full name',
            "ім'я", 'імя', 'піб', 'піб дитини', 'піб учасника', 'дитина', 'учень', 'учасник', 'фио', 'имя'
          ])),
          age: parseNumber(getRowValue(row, ['age', 'вік', 'возраст'])) || calculateAge(birthday),
          birthday,
          group_id: resolveGroupId(getRowValue(row, ['group_id', 'group', 'group name', 'group_name', 'група', 'назва групи'])),
          parent_name: cleanText(getRowValue(row, [
            'parent_name', 'parent name', 'parent_full_name', 'parent full name',
            'father mother', 'guardian', 'guardian_full_name',
            'батьки', 'батько', 'мама', 'тато', "ім'я батьків", 'імя батьків', 'піб батьків',
            'піб батька', 'піб матері', 'піб контактної особи', 'родитель'
          ])),
          phone: normalizedChildPhone,
          parent_phone: normalizedParentPhone,
          email: cleanText(getRowValue(row, [
            'email', 'e-mail', 'mail', 'parent_email', 'contact_email',
            'емейл', 'email батьків', 'пошта', 'електронна пошта'
          ])).toLowerCase(),
          member_type: cleanText(getRowValue(row, [
            'member_type', 'type', 'participant_type', 'registration_type',
            'тип', 'тип учасника', 'дорослий', 'дитина'
          ])).toLowerCase().match(/adult|дорос/) ? 'adult' : 'child',
          parent_login: parentLogin,
          has_explicit_login: !!explicitParentLogin,
          parent_password: getImportParentPassword(parentLogin, explicitParentPassword),
          has_explicit_password: !!explicitParentPassword,
          belt: normalizeBeltName(cleanText(getRowValue(row, ['belt', 'пояс']))),
          payment_status: normalizePaymentStatus(getRowValue(row, ['payment_status', 'payment', 'оплата', 'статус оплати'])),
          status: normalizeStatus(getRowValue(row, ['status', 'статус'])),
          telegram_chat_id: cleanText(getRowValue(row, ['telegram_chat_id', 'telegram chat id', 'chat_id', 'telegram id', 'тг id'])),
          exam_readiness: parseNumber(getRowValue(row, ['exam_readiness', 'exam readiness', 'готовність', 'готовність до іспиту'])),
          skill_checklist: parseChecklist(getRowValue(row, ['skill_checklist', 'skills', 'навички', 'чеклист'])),
          rank_points: parseNumber(getRowValue(row, ['rank_points', 'points', 'бали', 'рейтинг'])),
          achievements_text: [
            cleanText(getRowValue(row, ['achievements_text', 'achievements', 'досягнення', 'нотатки'])),
            cleanText(getRowValue(row, ['school_class_or_occupation', 'school class or occupation', 'клас', 'школа'])),
            cleanText(getRowValue(row, ['previous_sport_experience', 'previous sport experience', 'досвід'])),
            cleanText(getRowValue(row, ['training_goal', 'training goal', 'ціль тренувань'])),
            cleanText(getRowValue(row, ['medical_notes', 'medical notes', 'медичні примітки']))
          ].filter(Boolean).join('\n')
        };
      });

      const validParticipants = participantsToImport.filter(p => p.name);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        let created = 0;
        let updated = 0;
        const skipped = participantsToImport.length - validParticipants.length;

        for (const p of validParticipants) {
          let existing = null;

          if (p.parent_login) {
            existing = await client.query(
              "SELECT id FROM participants WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND parent_login = $2 LIMIT 1",
              [p.name, p.parent_login]
            );
          }
          if ((!existing || existing.rows.length === 0) && p.phone) {
            existing = await client.query(
              "SELECT id FROM participants WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (phone = $2 OR parent_phone = $2) LIMIT 1",
              [p.name, p.phone]
            );
          }

          if ((!existing || existing.rows.length === 0) && p.birthday) {
            existing = await client.query(
              "SELECT id FROM participants WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND birthday = $2::date LIMIT 1",
              [p.name, p.birthday]
            );
          }

          let importPassword = p.parent_password;
          if (!p.has_explicit_password && p.parent_login) {
            const existingParentPassword = await client.query(
              "SELECT parent_password FROM participants WHERE parent_login = $1 AND parent_password IS NOT NULL LIMIT 1",
              [p.parent_login]
            );
            if (existingParentPassword.rows[0]?.parent_password) {
              importPassword = existingParentPassword.rows[0].parent_password;
            }
          }

          const passwordValue = isBcryptHash(importPassword)
            ? importPassword
            : await bcrypt.hash(importPassword, 10);

          const insertData: Record<string, any> = {
            name: p.name,
            age: p.age ?? null,
            birthday: p.birthday ?? null,
            group_id: p.group_id ?? null,
            parent_name: p.parent_name ?? null,
            phone: p.phone || null,
            parent_phone: p.parent_phone || null,
            email: p.email || null,
            member_type: p.member_type || 'child',
            parent_login: p.parent_login,
            parent_password: passwordValue,
            belt: p.belt,
            payment_status: p.payment_status || 'unpaid',
            status: p.status || 'active',
            telegram_chat_id: p.telegram_chat_id || null,
            exam_readiness: p.exam_readiness ?? 0,
            skill_checklist: p.skill_checklist || '[]',
            rank_points: p.rank_points ?? 0,
            achievements_text: p.achievements_text || ''
          };

          if (existing && existing.rows.length > 0) {
            const existingId = existing.rows[0].id;
            const updateData: Record<string, any> = {};
            Object.entries(insertData).forEach(([key, value]) => {
              if (key !== 'parent_password' && value !== undefined && value !== null && value !== '') {
                updateData[key] = value;
              }
            });

            if (p.has_explicit_password) {
              updateData.parent_password = passwordValue;
            }

            const keys = Object.keys(updateData);
            if (keys.length > 0) {
              const setClause = keys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
              const values = keys.map(key => updateData[key]);
              values.push(existingId);
              await client.query(`UPDATE participants SET ${setClause} WHERE id = $${values.length}`, values);
            }
            updated += 1;
          } else {
            const keys = Object.keys(insertData);
            const columns = keys.join(', ');
            const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
            await client.query(
              `INSERT INTO participants (${columns}) VALUES (${placeholders})`,
              keys.map(key => insertData[key])
            );
            created += 1;
          }
        }

        await client.query('COMMIT');
        res.json({ success: true, count: created + updated, created, updated, skipped });
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
    const { name, age, birthday, group_id, parent_login, parent_password, payment_status, status, parent_name, phone, parent_phone, email, member_type, belt, achievements_text } = req.body;

    // Auto-generate credentials if missing
    const finalLogin = normalizeLogin(parent_login) || normalizeLogin(phone) || `parent_${Math.random().toString(36).substring(2, 8)}`;
    const rawPassword = parent_password || Math.random().toString(36).substring(2, 10);

    try {
      const accessDuplicate = await pool.query(
        `SELECT id FROM participant_accesses
         WHERE LOWER(TRIM(login)) = LOWER(TRIM($1))
         LIMIT 1`,
        [finalLogin]
      );
      if (accessDuplicate.rows.length > 0) {
        return res.status(409).json({ error: "This login is already used by a family access" });
      }

      let hashedPassword = rawPassword;
      if (!isBcryptHash(hashedPassword)) {
        hashedPassword = await bcrypt.hash(rawPassword, 10);
      }
      await pool.query(
        "INSERT INTO participants (name, age, birthday, group_id, parent_login, parent_password, payment_status, status, parent_name, phone, parent_phone, email, member_type, belt, achievements_text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
        [name, age, birthday || null, group_id || null, finalLogin, hashedPassword, payment_status || 'unpaid', status || 'active', parent_name, phone, parent_phone || phone || null, email || null, member_type || 'child', normalizeBeltName(belt), achievements_text || '']
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
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, req.params.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const allowedKeys = [
        'name', 'age', 'birthday', 'group_id', 'parent_login', 'parent_password',
        'belt', 'rank_points', 'payment_status', 'status', 'parent_name', 'phone',
        'parent_phone', 'email', 'member_type', 'telegram_chat_id', 'exam_readiness', 'skill_checklist', 'streak', 'last_attendance_date',
        'achievements_text'
      ];

      const updateData: any = {};
      for (const key of allowedKeys) {
        if (req.body[key] !== undefined) {
          updateData[key] = req.body[key];
        }
      }

      if (typeof updateData.parent_login === 'string') {
        updateData.parent_login = normalizeLogin(updateData.parent_login);
        if (!updateData.parent_login) {
          const fallbackLogin = normalizeLogin(updateData.phone);
          if (fallbackLogin) updateData.parent_login = fallbackLogin;
          else delete updateData.parent_login;
        }
      }

      if (updateData.belt !== undefined) {
        updateData.belt = normalizeBeltName(updateData.belt);
      }

      // Get current participant to check parent_login
      const currentRes = await pool.query("SELECT parent_login FROM participants WHERE id = $1", [req.params.id]);
      if (currentRes.rows.length === 0) return res.status(404).json({ error: "Participant not found" });
      const oldParentLogin = currentRes.rows[0]?.parent_login;

      if (updateData.parent_login && normalizeLogin(updateData.parent_login) !== normalizeLogin(oldParentLogin)) {
        const accessDuplicate = await pool.query(
          `SELECT id FROM participant_accesses
           WHERE LOWER(TRIM(login)) = LOWER(TRIM($1))
           LIMIT 1`,
          [updateData.parent_login]
        );
        if (accessDuplicate.rows.length > 0) {
          return res.status(409).json({ error: "This login is already used by a family access" });
        }
      }

      // Ignore masked/empty password placeholders from the admin UI.
      if (
        updateData.parent_password !== undefined &&
        (normalizeLogin(updateData.parent_password) === '' || isMaskedPassword(updateData.parent_password))
      ) {
        delete updateData.parent_password;
      }

      // Handle password hashing if a real new password was provided.
      if (updateData.parent_password && !isBcryptHash(updateData.parent_password)) {
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

      // If parent account/contact data changed, sync it for all children of this parent.
      if ((updateData.parent_login || updateData.parent_password || updateData.parent_phone !== undefined || updateData.email !== undefined || updateData.parent_name !== undefined) && oldParentLogin) {
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
        if (updateData.parent_phone !== undefined) {
          syncFields.push(`parent_phone = $${syncValues.length + 1}`);
          syncValues.push(updateData.parent_phone);
        }
        if (updateData.email !== undefined) {
          syncFields.push(`email = $${syncValues.length + 1}`);
          syncValues.push(updateData.email);
        }
        if (updateData.parent_name !== undefined) {
          syncFields.push(`parent_name = $${syncValues.length + 1}`);
          syncValues.push(updateData.parent_name);
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

  app.get("/api/participants/:id/accesses", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const user = (req as any).user;
      const participantId = Number(req.params.id);
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await pool.query(
        `SELECT id, participant_id, access_type, name, phone, login, email, can_login, created_at, updated_at
         FROM participant_accesses
         WHERE participant_id = $1
         ORDER BY id ASC`,
        [participantId]
      );
      res.json(result.rows);
    } catch (e) {
      console.error("Failed to fetch participant accesses:", e);
      res.status(500).json({ error: "Failed to fetch accesses" });
    }
  });

  app.post("/api/participants/:id/accesses", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const user = (req as any).user;
      const participantId = Number(req.params.id);
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { access_type, name, phone, login, password, email, can_login } = req.body;
      const finalLogin = normalizeLogin(login) || normalizePhone(phone || '');
      if (!finalLogin) {
        return res.status(400).json({ error: "Login or phone is required" });
      }
      if (!password || String(password).length < 4) {
        return res.status(400).json({ error: "Password must be at least 4 characters" });
      }

      const primaryConflict = await findBlockingPrimaryCredential(finalLogin, participantId);
      if (primaryConflict) {
        return res.status(409).json({ error: "This phone/login is already used as a primary parent login" });
      }

      const duplicate = await pool.query(
        `SELECT id FROM participant_accesses
         WHERE LOWER(TRIM(login)) = LOWER(TRIM($1))
         LIMIT 1`,
        [finalLogin]
      );
      if (duplicate.rows.length > 0) {
        return res.status(409).json({ error: "This login is already connected to a child account" });
      }

      const hashedPassword = await bcrypt.hash(String(password), 10);
      const result = await pool.query(
        `INSERT INTO participant_accesses (participant_id, access_type, name, phone, login, password_hash, email, can_login)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, participant_id, access_type, name, phone, login, email, can_login, created_at, updated_at`,
        [
          participantId,
          access_type || 'guardian',
          name || '',
          phone || finalLogin,
          finalLogin,
          hashedPassword,
          email || null,
          can_login !== false
        ]
      );

      await logAuditAction(user?.id || null, user?.role || 'admin', `Додано сімейний доступ: ${name || finalLogin}`, 'participant_access', participantId, {
        access_type: access_type || 'guardian',
        login: finalLogin
      });
      res.json(result.rows[0]);
    } catch (e) {
      console.error("Failed to create participant access:", e);
      res.status(500).json({ error: "Failed to create access" });
    }
  });

  app.put("/api/participants/:id/accesses/:accessId", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const user = (req as any).user;
      const participantId = Number(req.params.id);
      const accessId = Number(req.params.accessId);
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const existing = await pool.query(
        "SELECT id FROM participant_accesses WHERE id = $1 AND participant_id = $2",
        [accessId, participantId]
      );
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Access not found" });
      }

      const { access_type, name, phone, login, password, email, can_login } = req.body;
      const finalLogin = normalizeLogin(login) || normalizePhone(phone || '');
      if (!finalLogin) {
        return res.status(400).json({ error: "Login or phone is required" });
      }

      const primaryConflict = await findBlockingPrimaryCredential(finalLogin, participantId);
      if (primaryConflict) {
        return res.status(409).json({ error: "This phone/login is already used as a primary parent login" });
      }

      const duplicate = await pool.query(
        `SELECT id FROM participant_accesses
         WHERE LOWER(TRIM(login)) = LOWER(TRIM($1)) AND id != $2
         LIMIT 1`,
        [finalLogin, accessId]
      );
      if (duplicate.rows.length > 0) {
        return res.status(409).json({ error: "This login is already connected to a child account" });
      }

      const fields = [
        'access_type = $1',
        'name = $2',
        'phone = $3',
        'login = $4',
        'email = $5',
        'can_login = $6',
        'updated_at = CURRENT_TIMESTAMP'
      ];
      const values: any[] = [
        access_type || 'guardian',
        name || '',
        phone || finalLogin,
        finalLogin,
        email || null,
        can_login !== false
      ];

      if (password && !isMaskedPassword(password)) {
        if (String(password).length < 4) {
          return res.status(400).json({ error: "Password must be at least 4 characters" });
        }
        values.push(await bcrypt.hash(String(password), 10));
        fields.push(`password_hash = $${values.length}`);
      }

      values.push(accessId, participantId);
      const result = await pool.query(
        `UPDATE participant_accesses
         SET ${fields.join(', ')}
         WHERE id = $${values.length - 1} AND participant_id = $${values.length}
         RETURNING id, participant_id, access_type, name, phone, login, email, can_login, created_at, updated_at`,
        values
      );

      await logAuditAction(user?.id || null, user?.role || 'admin', `Оновлено сімейний доступ: ${name || finalLogin}`, 'participant_access', participantId, {
        access_id: accessId,
        access_type: access_type || 'guardian',
        login: finalLogin
      });
      res.json(result.rows[0]);
    } catch (e) {
      console.error("Failed to update participant access:", e);
      res.status(500).json({ error: "Failed to update access" });
    }
  });

  app.delete("/api/participants/:id/accesses/:accessId", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const user = (req as any).user;
      const participantId = Number(req.params.id);
      const accessId = Number(req.params.accessId);
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await pool.query(
        "DELETE FROM participant_accesses WHERE id = $1 AND participant_id = $2 RETURNING id, login, name",
        [accessId, participantId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Access not found" });
      }

      await logAuditAction(user?.id || null, user?.role || 'admin', `Видалено сімейний доступ: ${result.rows[0].name || result.rows[0].login}`, 'participant_access', participantId, {
        access_id: accessId
      });
      res.json({ success: true });
    } catch (e) {
      console.error("Failed to delete participant access:", e);
      res.status(500).json({ error: "Failed to delete access" });
    }
  });

  app.delete("/api/participants/:id", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, req.params.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, req.params.id))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await pool.query(
        "UPDATE participants SET belt = $1, rank_points = $2 WHERE id = $3",
        [normalizeBeltName(belt), rank_points, req.params.id]
      );

      const coachId = (req as any).user?.id || null;
      const userRole = (req as any).user?.role || 'coach';

      logAuditAction(coachId, userRole, `Зміна рангу: ${normalizeBeltName(belt)}, Бали: ${rank_points}`, 'participant', parseInt(req.params.id));

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update rank" });
    }
  });

  app.post("/api/participants/:id/points", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });

    const user = (req as any).user;
    const participantId = Number(req.params.id);
    const pointValue = Math.trunc(Number(req.body.points));
    const date = normalizeDate(req.body.date);
    const note = String(req.body.note || '').trim();
    const rawReason = String(req.body.reason || 'coach_bonus').trim();
    const allowedReasons = new Set(['coach_bonus', 'discipline', 'technique', 'progress', 'seminar_bonus', 'manual_adjustment']);
    const reason = allowedReasons.has(rawReason) ? rawReason : 'coach_bonus';

    if (!Number.isFinite(participantId)) {
      return res.status(400).json({ error: "Invalid participant id" });
    }
    if (!Number.isFinite(pointValue) || pointValue === 0 || Math.abs(pointValue) > 50) {
      return res.status(400).json({ error: "Points must be between -50 and 50 and not zero" });
    }

    try {
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await pool.query("BEGIN");

      await pool.query(
        "INSERT INTO points_log (participant_id, points, reason, date) VALUES ($1, $2, $3, $4)",
        [participantId, pointValue, reason, date]
      );

      const updated = await pool.query(
        "UPDATE participants SET rank_points = GREATEST(0, COALESCE(rank_points, 0) + $1) WHERE id = $2 RETURNING id, rank_points",
        [pointValue, participantId]
      );

      if (updated.rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Participant not found" });
      }

      if (note) {
        await pool.query(
          `INSERT INTO coach_notes (participant_id, coach_id, content, visibility)
           VALUES ($1, $2, $3, 'parent')`,
          [participantId, user?.coach_id || null, note]
        );
      }

      await pool.query("COMMIT");

      await logAuditAction(user?.id || null, user?.role || 'coach', `Додано бали: ${pointValue}`, 'participant', participantId, {
        reason,
        date,
        has_note: Boolean(note)
      });

      res.json({ success: true, rank_points: updated.rows[0].rank_points });
    } catch (e) {
      await pool.query("ROLLBACK");
      console.error("Failed to add participant points:", e);
      res.status(500).json({ error: "Failed to add points" });
    }
  });

  // Badges (Achievements)
  app.get("/api/badges", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT b.*, p.name as participant_name
        FROM badges b
        JOIN participants p ON b.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
      `;
      const params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` WHERE g.coach_id = $${params.length}`;
      }
      query += " ORDER BY b.date DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.get("/api/participants/:id/badges", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT b.*
        FROM badges b
        JOIN participants p ON b.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE b.participant_id = $1
      `;
      const params: any[] = [req.params.id];
      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` AND g.coach_id = $${params.length}`;
      }
      query += " ORDER BY b.date DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch participant badges" });
    }
  });

  app.post("/api/badges", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const { participant_id, type, date } = req.body;
    const normalizedDate = normalizeDate(date);
    try {
      const user = (req as any).user;
      if (user?.role === 'coach' && user.coach_id) {
        const access = await pool.query(`
          SELECT p.id
          FROM participants p
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE p.id = $1 AND g.coach_id = $2
        `, [participant_id, user.coach_id]);
        if (access.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      }

      await pool.query("BEGIN");
      const result = await pool.query(
        "INSERT INTO badges (participant_id, type, date) VALUES ($1, $2, $3) RETURNING id",
        [participant_id, type, normalizedDate]
      );
      const badgeId = result.rows[0].id;

      // Increment rank points by 10 for a badge
      await pool.query(
        "INSERT INTO points_log (participant_id, points, reason, date, reference_id) VALUES ($1, $2, $3, $4, $5)",
        [participant_id, 10, 'badge', normalizedDate, `badge_${badgeId}`]
      );
      await pool.query("UPDATE participants SET rank_points = rank_points + 10 WHERE id = $1", [participant_id]);
      await pool.query("COMMIT");

      const coachId = (req as any).user?.id || null;
      const userRole = (req as any).user?.role || 'coach';

      logAuditAction(coachId, userRole, `Присвоєно досягнення: ${type}`, 'badge', participant_id);

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
        const user = (req as any).user;
        if (user?.role === 'coach' && user.coach_id) {
          const access = await pool.query(`
            SELECT p.id
            FROM participants p
            LEFT JOIN groups g ON p.group_id = g.id
            WHERE p.id = $1 AND g.coach_id = $2
          `, [participantId, user.coach_id]);
          if (access.rows.length === 0) {
            await pool.query("ROLLBACK");
            return res.status(403).json({ error: "Forbidden" });
          }
        }

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
    const user = (req as any).user;
    try {
      let query = `
        SELECT c.*, p.name as participant_name
        FROM competitions c
        JOIN participants p ON c.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
      `;
      const params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` WHERE g.coach_id = $${params.length}`;
      }
      query += " ORDER BY c.date DESC";
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch competitions" });
    }
  });

  app.get("/api/participants/:id/competitions", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;
    try {
      let query = `
        SELECT c.*
        FROM competitions c
        JOIN participants p ON c.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE c.participant_id = $1
      `;
      const params: any[] = [req.params.id];
      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` AND g.coach_id = $${params.length}`;
      }
      query += " ORDER BY c.date DESC";
      const result = await pool.query(query, params);
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
    const normalizedDate = normalizeDate(date);
    try {
      const user = (req as any).user;
      if (user?.role === 'coach' && user.coach_id) {
        const access = await pool.query(`
          SELECT p.id
          FROM participants p
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE p.id = $1 AND g.coach_id = $2
        `, [participant_id, user.coach_id]);
        if (access.rows.length === 0) return res.status(403).json({ error: "Forbidden" });
      }

      await pool.query("BEGIN");
      const insertRes = await pool.query(
        "INSERT INTO competitions (participant_id, name, type, result, date) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [participant_id, name, type, result, normalizedDate]
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
        points = 10;
      }

      await pool.query(
        "INSERT INTO points_log (participant_id, points, reason, date, reference_id) VALUES ($1, $2, $3, $4, $5)",
        [participant_id, points, `${type}_${result || name}`, normalizedDate, `comp_${compId}`]
      );

      await pool.query("UPDATE participants SET rank_points = rank_points + $1 WHERE id = $2", [points, participant_id]);
      await pool.query("COMMIT");

      const coachId = (req as any).user?.id || null;
      const userRole = (req as any).user?.role || 'coach';

      logAuditAction(coachId, userRole, `Участь у заході/змаганнях: ${name} (${result})`, 'competition', participant_id, { points });

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
        const user = (req as any).user;
        if (user?.role === 'coach' && user.coach_id) {
          const access = await pool.query(`
            SELECT p.id
            FROM participants p
            LEFT JOIN groups g ON p.group_id = g.id
            WHERE p.id = $1 AND g.coach_id = $2
          `, [participantId, user.coach_id]);
          if (access.rows.length === 0) {
            await pool.query("ROLLBACK");
            return res.status(403).json({ error: "Forbidden" });
          }
        }

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

  // Homework
  app.post("/api/homework/generate", requireAuth, async (req, res) => {
    try {
      res.json({ suggestions: generateHomeworkSuggestions(req.body || {}) });
    } catch (e) {
      res.status(500).json({ error: "Failed to generate homework" });
    }
  });

  app.get("/api/homework", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;

    try {
      const params: any[] = [];
      const where: string[] = ["ha.status <> 'archived'"];
      if (user.role === 'coach') {
        params.push(user.coach_id || -1);
        where.push(`g.coach_id = $${params.length}`);
      }

      const result = await pool.query(`
        SELECT
          ha.*,
          g.name as group_name,
          c.name as coach_name,
          COUNT(hap.id)::int as recipients_count,
          COUNT(*) FILTER (WHERE hap.status = 'submitted')::int as submitted_count,
          COUNT(*) FILTER (WHERE hap.status = 'approved')::int as approved_count,
          COUNT(*) FILTER (WHERE hap.status = 'needs_work')::int as needs_work_count
        FROM homework_assignments ha
        LEFT JOIN groups g ON ha.group_id = g.id
        LEFT JOIN coaches c ON ha.coach_id = c.id
        LEFT JOIN homework_assignment_participants hap ON hap.assignment_id = ha.id
        WHERE ${where.join(' AND ')}
        GROUP BY ha.id, g.name, c.name
        ORDER BY ha.created_at DESC
        LIMIT 80
      `, params);

      res.json(result.rows);
    } catch (e) {
      console.error("Failed to fetch homework:", e);
      res.status(500).json({ error: "Failed to fetch homework" });
    }
  });

  app.get("/api/homework/submissions", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const user = (req as any).user;

    try {
      const params: any[] = [];
      const where: string[] = ["ha.status <> 'archived'"];
      if (user.role === 'coach') {
        params.push(user.coach_id || -1);
        where.push(`g.coach_id = $${params.length}`);
      }

      const status = String(req.query.status || '');
      if (status && ['assigned', 'in_progress', 'submitted', 'approved', 'needs_work'].includes(status)) {
        params.push(status);
        where.push(`hap.status = $${params.length}`);
      }

      const result = await pool.query(`
        SELECT
          hap.id,
          hap.assignment_id,
          hap.participant_id,
          hap.status,
          hap.diary_entries,
          hap.total_minutes,
          hap.parent_comment,
          hap.coach_feedback,
          hap.points_awarded,
          hap.submitted_at,
          hap.reviewed_at,
          hap.updated_at,
          ha.title,
          ha.description,
          ha.focus,
          ha.difficulty,
          ha.estimated_minutes,
          ha.due_date,
          ha.exercises,
          p.name as participant_name,
          g.name as group_name
        FROM homework_assignment_participants hap
        JOIN homework_assignments ha ON hap.assignment_id = ha.id
        JOIN participants p ON hap.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE hap.status WHEN 'submitted' THEN 0 WHEN 'needs_work' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
          hap.submitted_at DESC NULLS LAST,
          ha.due_date ASC NULLS LAST,
          ha.created_at DESC
        LIMIT 120
      `, params);

      res.json(result.rows);
    } catch (e) {
      console.error("Failed to fetch homework submissions:", e);
      res.status(500).json({ error: "Failed to fetch homework submissions" });
    }
  });

  app.post("/api/homework", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    const {
      title,
      description,
      focus,
      difficulty,
      estimated_minutes,
      due_date,
      group_id,
      participant_ids,
      exercises
    } = req.body || {};

    const normalizedExercises = normalizeHomeworkExercises(exercises);
    if (!String(title || '').trim()) return res.status(400).json({ error: "Title is required" });
    if (normalizedExercises.length === 0) return res.status(400).json({ error: "Add at least one exercise" });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureNotificationReferenceColumns(client);

      const participantIds = new Set<number>();
      const parsedGroupId = (group_id === null || group_id === undefined || group_id === '') ? NaN : Number(group_id);
      let finalGroupId: number | null = Number.isFinite(parsedGroupId) && parsedGroupId > 0 ? parsedGroupId : null;
      let finalCoachId: number | null = user.role === 'coach' ? Number(user.coach_id) : null;

      if (finalGroupId) {
        if (!(await canAccessGroup(user, finalGroupId))) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: "Forbidden group" });
        }

        const groupRes = await client.query("SELECT coach_id FROM groups WHERE id = $1", [finalGroupId]);
        finalCoachId = finalCoachId || groupRes.rows[0]?.coach_id || null;

        const participantsRes = await client.query(
          "SELECT id FROM participants WHERE group_id = $1 AND COALESCE(status, 'active') <> 'archived'",
          [finalGroupId]
        );
        participantsRes.rows.forEach((row: any) => participantIds.add(Number(row.id)));
      }

      if (Array.isArray(participant_ids)) {
        for (const rawId of participant_ids) {
          const id = Number(rawId);
          if (Number.isFinite(id) && await canAccessParticipant(user, id)) {
            participantIds.add(id);
          }
        }
      }

      const finalParticipantIds = Array.from(participantIds);
      if (finalParticipantIds.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "No accessible participants selected" });
      }

      const assignmentRes = await client.query(`
        INSERT INTO homework_assignments
          (title, description, focus, difficulty, estimated_minutes, due_date, group_id, coach_id, created_by_user_id, exercises)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        RETURNING *
      `, [
        String(title).trim(),
        String(description || '').trim(),
        String(focus || 'technique'),
        String(difficulty || 'medium'),
        Math.max(5, Math.min(90, Number(estimated_minutes) || 15)),
        due_date || null,
        finalGroupId,
        finalCoachId,
        Number.isFinite(Number(user.id)) ? Number(user.id) : null,
        JSON.stringify(normalizedExercises)
      ]);

      const assignment = assignmentRes.rows[0];
      for (const participantId of finalParticipantIds) {
        const assignmentParticipantRes = await client.query(`
          INSERT INTO homework_assignment_participants (assignment_id, participant_id)
          SELECT $1, $2
          WHERE NOT EXISTS (
            SELECT 1
            FROM homework_assignment_participants
            WHERE assignment_id = $1 AND participant_id = $2
          )
          RETURNING id
        `, [assignment.id, participantId]);
        const assignmentParticipantId = assignmentParticipantRes.rows[0]?.id;
        await client.query(
          "INSERT INTO notifications (participant_id, type, message, reference_type, reference_id) VALUES ($1, 'homework', $2, 'homework', $3)",
          [participantId, `Нове домашнє завдання: ${assignment.title}`, assignmentParticipantId ? String(assignmentParticipantId) : String(assignment.id)]
        );
      }

      await client.query('COMMIT');
      res.json({ success: true, assignment, count: finalParticipantIds.length });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Failed to create homework:", e);
      res.status(500).json({ error: "Failed to create homework" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/homework/:id/archive", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    try {
      const assignmentRes = await pool.query(`
        SELECT ha.id, g.coach_id
        FROM homework_assignments ha
        LEFT JOIN groups g ON ha.group_id = g.id
        WHERE ha.id = $1
      `, [req.params.id]);
      if (assignmentRes.rows.length === 0) return res.status(404).json({ error: "Homework not found" });
      if (user.role === 'coach' && assignmentRes.rows[0].coach_id !== user.coach_id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await pool.query("UPDATE homework_assignments SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to archive homework" });
    }
  });

  app.patch("/api/homework/submissions/:id/review", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    const status = ['approved', 'needs_work'].includes(String(req.body?.status)) ? String(req.body.status) : 'approved';
    const coachFeedback = String(req.body?.coach_feedback || '').trim();
    const nextPoints = Math.max(0, Math.min(50, Number(req.body?.points_awarded) || 0));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await ensureNotificationReferenceColumns(client);

      const currentRes = await client.query(`
        SELECT hap.*, ha.title, p.name as participant_name, g.coach_id
        FROM homework_assignment_participants hap
        JOIN homework_assignments ha ON hap.assignment_id = ha.id
        JOIN participants p ON hap.participant_id = p.id
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE hap.id = $1
      `, [req.params.id]);

      if (currentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Submission not found" });
      }

      const current = currentRes.rows[0];
      if (user.role === 'coach' && current.coach_id !== user.coach_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: "Forbidden" });
      }

      const previousPoints = Number(current.points_awarded || 0);
      const pointDelta = status === 'approved' ? nextPoints - previousPoints : 0 - previousPoints;

      await client.query(`
        UPDATE homework_assignment_participants
        SET status = $1,
            coach_feedback = $2,
            points_awarded = $3,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [status, coachFeedback, status === 'approved' ? nextPoints : 0, req.params.id]);

      if (pointDelta !== 0) {
        await client.query(
          "UPDATE participants SET rank_points = COALESCE(rank_points, 0) + $1 WHERE id = $2",
          [pointDelta, current.participant_id]
        );
        await client.query(
          "INSERT INTO points_log (participant_id, points, reason, date, reference_id) VALUES ($1, $2, 'homework', CURRENT_DATE, $3)",
          [current.participant_id, pointDelta, `homework_${current.id}`]
        );
      }

      await client.query(
        "INSERT INTO notifications (participant_id, type, message, reference_type, reference_id) VALUES ($1, 'homework_review', $2, 'homework', $3)",
        [
          current.participant_id,
          status === 'approved'
            ? `Домашнє завдання "${current.title}" перевірено. ${nextPoints > 0 ? `+${nextPoints} балів.` : ''}`
            : `Тренер залишив правки до ДЗ "${current.title}".`,
          String(current.id)
        ]
      );

      await client.query('COMMIT');
      res.json({ success: true, status, points_awarded: status === 'approved' ? nextPoints : 0 });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Failed to review homework:", e);
      res.status(500).json({ error: "Failed to review homework" });
    } finally {
      client.release();
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
        SELECT p.id, p.name, g.coach_id
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.status = 'active'
        AND (
          p.last_attendance_date < CURRENT_DATE - INTERVAL '14 days'
          OR (p.last_attendance_date IS NULL AND p.created_at < CURRENT_TIMESTAMP - INTERVAL '14 days')
        )
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
        LEFT JOIN groups g ON p.group_id = g.id
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

    if (!participant_id || !amount) {
      return res.status(400).json({ error: "Participant ID and amount are required" });
    }

    const user = (req as any).user;
    if (!(await canAccessParticipant(user, participant_id))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const normalizedDate = normalizeDate(date);
      const numAmount = parseFloat(amount.toString().replace(',', '.').replace(/\s/g, ''));
      if (isNaN(numAmount)) {
        return res.status(400).json({ error: "Invalid amount format" });
      }
      const numMonth = parseInt(month?.toString() || (new Date().getMonth() + 1).toString());
      const numYear = parseInt(year?.toString() || new Date().getFullYear().toString());
      const paymentType = type || 'subscription';

    try {
      const result = await pool.query(
        "INSERT INTO payments (participant_id, amount, date, month, year, type, method, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [participant_id, numAmount, normalizedDate, numMonth, numYear, paymentType, method || 'cash', notes]
      );

      // Update participant payment status if it's a subscription for current month
      const now = new Date();
      if (paymentType === 'subscription' && numMonth === (now.getMonth() + 1) && numYear === now.getFullYear()) {
        await pool.query("UPDATE participants SET payment_status = 'paid' WHERE id = $1", [participant_id]);
      }

      const coachId = (req as any).user?.id || null;
      const userRole = (req as any).user?.role || 'admin';

      logAuditAction(coachId, userRole, `Проведено оплату: ${amount} ₴ (${type})`, 'payment', participant_id, { month, year, method });

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

  app.post("/api/payment-reminders", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;

    try {
      let query = `
        SELECT p.id, p.name, p.parent_name, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.status = 'active'
        AND COALESCE(p.payment_status, 'unpaid') != 'paid'
      `;
      const params: any[] = [];

      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` AND g.coach_id = $${params.length}`;
      }

      query += " ORDER BY p.name ASC";
      const debtors = await pool.query(query, params);
      const now = new Date();
      const monthLabel = now.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
      let created = 0;
      const skipped: number[] = [];

      for (const debtor of debtors.rows) {
        const message = `Нагадування про оплату за ${monthLabel}: будь ласка, перевірте оплату занять для ${debtor.name}. Якщо вже оплатили, повідомте тренера або адміністратора.`;
        const insertRes = await pool.query(`
          INSERT INTO notifications (participant_id, type, message)
          SELECT $1, 'payment', $2
          WHERE NOT EXISTS (
            SELECT 1
            FROM notifications
            WHERE participant_id = $1
            AND type = 'payment'
            AND created_at >= NOW() - INTERVAL '7 days'
          )
          RETURNING id
        `, [debtor.id, message]);

        if (insertRes.rowCount && insertRes.rowCount > 0) {
          created += 1;
        } else {
          skipped.push(Number(debtor.id));
        }
      }

      const coachId = user?.id || null;
      const userRole = user?.role || 'admin';
      logAuditAction(coachId, userRole, `Створено нагадування оплат: ${created}`, 'payment', null, {
        total_debtors: debtors.rows.length,
        skipped_recent: skipped.length
      });

      res.json({
        success: true,
        created,
        total_debtors: debtors.rows.length,
        skipped_recent: skipped.length
      });
    } catch (e) {
      console.error("Failed to create payment reminders:", e);
      res.status(500).json({ error: "Failed to create payment reminders" });
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
        LEFT JOIN groups g ON p.group_id = g.id
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
      let result;
      if (user.role === 'admin') {
        result = await pool.query("DELETE FROM notifications");
      } else if (user.role === 'coach' && user.coach_id) {
        result = await pool.query(`
          DELETE FROM notifications
          WHERE participant_id IN (
            SELECT p.id FROM participants p
            JOIN groups g ON p.group_id = g.id
            WHERE g.coach_id = $1
          )
        `, [user.coach_id]);
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ success: true, deleted: result?.rowCount || 0 });
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

  app.delete("/api/messages", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const user = (req as any).user;
    try {
      let result;
      if (user.role === 'admin') {
        result = await pool.query("DELETE FROM messages");
      } else if (user.role === 'coach' && user.coach_id) {
        result = await pool.query(`
          DELETE FROM messages
          WHERE participant_id IN (
            SELECT p.id FROM participants p
            JOIN groups g ON p.group_id = g.id
            WHERE g.coach_id = $1
          )
        `, [user.coach_id]);
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ success: true, deleted: result?.rowCount || 0 });
    } catch (e) {
      console.error("Failed to clear messages:", e);
      res.status(500).json({ error: "Failed to clear messages" });
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
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const coachName = (req as any).user?.name || 'Адмін';
      await notifyParent(participantId, 'manual', message, coachName);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  app.post("/api/admin/notify/mass", requireAuth, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "DB error" });
    const { message, group_id } = req.body;
    const coachName = (req as any).user?.name || 'Адмін';
    try {
      const user = (req as any).user;
      let query = `
        SELECT p.id
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.status = 'active'
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        params.push(user.coach_id);
        query += ` AND g.coach_id = $${params.length}`;
      }
      if (group_id && group_id !== 'all') {
        if (user.role === 'coach') {
          const allowed = await pool.query(
            "SELECT id FROM groups WHERE id = $1 AND coach_id = $2",
            [group_id, user.coach_id]
          );
          if (allowed.rows.length === 0) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        params.push(group_id);
        query += ` AND p.group_id = $${params.length}`;
      }
      const result = await pool.query(query, params);

      const deliveries = await Promise.allSettled(
        result.rows.map((p: any) => notifyParent(p.id, 'announcement', message, coachName))
      );
      const failed = deliveries.filter(d => d.status === 'rejected').length;

      res.json({ success: true, count: result.rows.length, failed });
    } catch (e) {
      res.status(500).json({ error: "Failed mass notify" });
    }
  });

  app.post("/api/bug-report", requireAuth, async (req, res) => {
    const user = (req as any).user || {};
    const { message, page, activeTab, role, userName, userAgent } = req.body || {};
    const text = String(message || '').trim();

    if (text.length < 5) {
      return res.status(400).json({ error: "Message is too short" });
    }

    const clippedText = text.slice(0, 1000);
    const actorRole = String(user.role || role || 'unknown').slice(0, 50);
    const actorName = String(user.name || userName || user.login || 'unknown').slice(0, 120);
    const tab = String(activeTab || '').slice(0, 80);
    const currentPage = String(page || '').slice(0, 500);
    const browser = String(userAgent || '').slice(0, 300);

    try {
      const telegramText = [
        '<b>Bug report Black Bear</b>',
        '',
        `<b>User:</b> ${escapeTelegramHtml(actorName)} (${escapeTelegramHtml(actorRole)})`,
        tab ? `<b>Section:</b> ${escapeTelegramHtml(tab)}` : '',
        currentPage ? `<b>Page:</b> ${escapeTelegramHtml(currentPage)}` : '',
        '',
        `<b>Message:</b>\n${escapeTelegramHtml(clippedText)}`,
        '',
        browser ? `<b>Browser:</b> ${escapeTelegramHtml(browser)}` : ''
      ].filter(Boolean).join('\n');

      const sent = await sendTelegramMessage(telegramText);
      await logAuditAction(
        user.id || user.coach_id || 0,
        actorRole,
        `Bug report: ${clippedText.slice(0, 120)}`,
        'bug_report',
        undefined,
        { page: currentPage, activeTab: tab, telegramSent: sent }
      );

      if (!sent) {
        return res.status(502).json({ error: "Telegram notification failed" });
      }

      res.json({ success: true });
    } catch (e) {
      console.error('Failed to send bug report:', e);
      res.status(500).json({ error: "Failed to send bug report" });
    }
  });

  // Messaging API
  app.get("/api/messages/:participantId", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, req.params.participantId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
      if (!(await canAccessParticipant(user, participant_id))) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const actualSenderType = user?.role === 'parent'
        ? 'parent'
        : user?.role === 'admin'
          ? (sender_type === 'admin' ? 'admin' : 'coach')
          : 'coach';

      let sender_id = null;
      if (actualSenderType === 'coach') sender_id = user.coach_id || user.id;
      else if (actualSenderType === 'admin') sender_id = user.id;

      const result = await pool.query(
        "INSERT INTO messages (participant_id, content, sender_type, sender_id) VALUES ($1, $2, $3, $4) RETURNING *",
        [participant_id, content, actualSenderType, sender_id]
      );

      // If parent sends to coach, notify coach via Telegram if possible
      if (actualSenderType === 'parent') {
        const coachRes = await pool.query(`
          SELECT c.telegram_chat_id, c.name as coach_name, p.name as child_name
          FROM participants p
          JOIN groups g ON p.group_id = g.id
          LEFT JOIN coaches c ON g.coach_id = c.id
          WHERE p.id = $1
        `, [participant_id]);

        const childName = coachRes.rows[0]?.child_name || 'учень';
        const coachName = coachRes.rows[0]?.coach_name || 'тренер';
        const text = `<b>Нове повідомлення від батьків</b>\n\nУчень: <b>${escapeTelegramHtml(childName)}</b>\nТренер: <b>${escapeTelegramHtml(coachName)}</b>\n\n${escapeTelegramHtml(content)}`;
        const sentToCoach = coachRes.rows[0]?.telegram_chat_id
          ? await sendTelegramMessage(text, coachRes.rows[0].telegram_chat_id)
          : false;
        if (!sentToCoach) {
          await sendTelegramMessage(text);
        }
      } else {
        // If coach/admin sends to parent, notify parent via Telegram
        const coachName = (req as any).user?.name || 'Тренер';
        await notifyParent(participant_id, 'message', `Нове повідомлення від тренера: ${content}`, coachName);
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
        LEFT JOIN groups g ON p.group_id = g.id
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
      const user = (req as any).user;
      if (!(await canAccessParticipant(user, participant_id))) {
        return res.status(403).json({ error: "Forbidden" });
      }

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
      const coachId = (req as any).user?.id || null;
      const userRole = (req as any).user?.role || 'coach';

      logAuditAction(coachId, userRole, `Відмічено відвідування: ${status}`, 'attendance', participant_id, { date });

      res.json({ success: true });
    } catch (e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    try {
      const { limit = 100 } = req.query;
      const result = await pool.query(`
        SELECT al.*,
               COALESCE(au.name, c.name, 'Система') as user_name
        FROM audit_logs al
        LEFT JOIN admin_users au ON al.user_id = au.id AND al.user_role != 'parent'
        LEFT JOIN coaches c ON au.coach_id = c.id
        ORDER BY al.created_at DESC
        LIMIT $1
      `, [parseInt(limit as string)]);
      res.json(result.rows);
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.delete("/api/audit-logs", requireAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    try {
      const result = await pool.query("DELETE FROM audit_logs");
      res.json({ success: true, deleted: result.rowCount || 0 });
    } catch (e) {
      console.error('Failed to clear audit logs:', e);
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  app.delete("/api/audit-logs/test-artifacts", requireAdmin, async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const patterns = [
      '%ZZZ_TEST%',
      '%TEST_FAMILY%',
      '%QA-Codex%',
      '%TEST Codex%',
      '%Test Mother%',
      '%Codex%',
      '%TEST LAUNCH%',
      '%TEST FLOW%',
      '%Тестовий семінар запуску%',
      '%Тестова дисципліна%'
    ];
    try {
      const result = await pool.query(
        `DELETE FROM audit_logs
         WHERE COALESCE(action, '') ILIKE ANY($1::text[])
            OR COALESCE(details::text, '') ILIKE ANY($1::text[])
         RETURNING id, action`,
        [patterns]
      );
      res.json({
        success: true,
        deleted: result.rowCount || 0,
        ids: result.rows.map(row => row.id)
      });
    } catch (e) {
      console.error('Failed to clear test audit logs:', e);
      res.status(500).json({ error: "Failed to clear test logs" });
    }
  });

  // Ratings and Birthdays
  app.get("/api/ratings", requireAuth, async (req, res) => {
    if (!pool) return res.json([]);
    const { period, global } = req.query; // 'month', 'season', 'year', global: 'true'
    const user = (req as any).user;

    try {
      let periodStartSql = "";
      if (period === 'month') {
        periodStartSql = "date_trunc('month', CURRENT_DATE)";
      } else if (period === 'year') {
        periodStartSql = "date_trunc('year', CURRENT_DATE)";
      } else if (period === 'season') {
        periodStartSql = `CASE
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) = 12 THEN date_trunc('year', CURRENT_DATE) + INTERVAL '11 months'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (1, 2) THEN date_trunc('year', CURRENT_DATE) - INTERVAL '1 month'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (3, 4, 5) THEN date_trunc('year', CURRENT_DATE) + INTERVAL '2 months'
          WHEN EXTRACT(MONTH FROM CURRENT_DATE) IN (6, 7, 8) THEN date_trunc('year', CURRENT_DATE) + INTERVAL '5 months'
          ELSE date_trunc('year', CURRENT_DATE) + INTERVAL '8 months'
        END`;
      }
      const dateFilter = periodStartSql ? `AND pl.date >= ${periodStartSql}` : "";
      const homeworkReviewedDateFilter = periodStartSql ? `AND COALESCE(hap.reviewed_at, hap.updated_at, hap.created_at) >= ${periodStartSql}` : "";
      const homeworkAssignedDateFilter = periodStartSql
        ? `AND (hap.created_at >= ${periodStartSql} OR COALESCE(hap.reviewed_at, hap.updated_at, hap.created_at) >= ${periodStartSql})`
        : "";

      let query = `
        SELECT
          p.id,
          p.name,
          GREATEST(COALESCE(SUM(pl.points), 0), COALESCE(p.rank_points, 0))::int as total_points,
          COALESCE(SUM(pl.points), 0)::int as period_points,
          COALESCE(SUM(CASE WHEN pl.reason = 'homework' THEN pl.points ELSE 0 END), 0)::int as homework_points,
          COALESCE((
            SELECT COUNT(*)
            FROM homework_assignment_participants hap
            WHERE hap.participant_id = p.id
            AND hap.status = 'approved'
            ${homeworkReviewedDateFilter}
          ), 0)::int as homework_approved_count,
          COALESCE((
            SELECT COUNT(*)
            FROM homework_assignment_participants hap
            WHERE hap.participant_id = p.id
            ${homeworkAssignedDateFilter}
          ), 0)::int as homework_assigned_count,
          CASE
            WHEN COALESCE((
              SELECT COUNT(*)
              FROM homework_assignment_participants hap
              WHERE hap.participant_id = p.id
              ${homeworkAssignedDateFilter}
            ), 0) = 0 THEN 0
            ELSE ROUND(
              COALESCE((
                SELECT COUNT(*)
                FROM homework_assignment_participants hap
                WHERE hap.participant_id = p.id
                AND hap.status = 'approved'
                ${homeworkReviewedDateFilter}
              ), 0)::numeric * 100 /
              NULLIF((
                SELECT COUNT(*)
                FROM homework_assignment_participants hap
                WHERE hap.participant_id = p.id
                ${homeworkAssignedDateFilter}
              ), 0)
            )::int
          END as homework_completion_rate,
          g.name as group_name,
          l.name as location_name
        FROM participants p
        LEFT JOIN points_log pl ON p.id = pl.participant_id ${dateFilter}
        LEFT JOIN groups g ON p.group_id = g.id
        LEFT JOIN locations l ON g.location_id = l.id
        WHERE p.status = 'active'
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id && global !== 'true') {
        query += " AND g.coach_id = $1";
        params.push(user.coach_id);
      }
      query += " GROUP BY p.id, p.name, p.rank_points, g.name, l.name ORDER BY total_points DESC, homework_points DESC, homework_approved_count DESC, p.name ASC LIMIT 20";

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
    const daysWindow = Math.max(0, Math.min(365, Number(req.query.days || 0)));
    try {
      let query = `
        SELECT p.*, g.name as group_name
        FROM participants p
        LEFT JOIN groups g ON p.group_id = g.id
        WHERE p.birthday IS NOT NULL
        AND p.status = 'active'
      `;
      let params: any[] = [];
      if (user.role === 'coach' && user.coach_id) {
        query += " AND g.coach_id = $1";
        params.push(user.coach_id);
      }
      const result = await pool.query(query, params);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const birthdays = result.rows
        .map((row: any) => {
          const birthDate = new Date(row.birthday);
          const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
          if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
          const daysUntil = Math.round((nextBirthday.getTime() - today.getTime()) / 86400000);
          return {
            ...row,
            days_until: daysUntil,
            next_birthday: nextBirthday.toISOString().split('T')[0],
            age_turning: row.age ? Number(row.age) + (daysUntil === 0 ? 0 : 1) : null
          };
        })
        .filter((row: any) => row.days_until <= daysWindow)
        .sort((a: any, b: any) => a.days_until - b.days_until || a.name.localeCompare(b.name, 'uk'));

      res.json(birthdays);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch birthdays" });
    }
  });

  // Profile (for parents)
  app.get("/api/profile", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const participantId = await getParentParticipantId(req);
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
      const participant = pResult.rows[0];
      delete participant.parent_password;

      res.json({
        participant,
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
    const imageData = parseSafeImageData(image);
    if (!imageData) {
      return res.status(400).json({ error: "Invalid image data or image is too large" });
    }

    try {
      const result = await pool.query(
        "INSERT INTO images (data, content_type) VALUES ($1, $2) RETURNING id",
        [imageData.dataUrl, imageData.contentType]
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
    if (!/^\d+$/.test(id)) {
      return res.status(400).send("Invalid image id");
    }
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

      const { data } = result.rows[0];
      const imageData = parseSafeImageData(data);
      if (!imageData) {
        return res.status(400).send("Invalid image format in database");
      }

      // Update cache
      imageCache.set(cacheKey, { contentType: imageData.contentType, buffer: imageData.buffer, timestamp: Date.now() });

      res.setHeader('Content-Type', imageData.contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(imageData.buffer);
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

      console.log('Announcement saved; Telegram delivery disabled to keep the bot quiet.');

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
    const participantId = await getParentParticipantId(req);
    if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

    try {
      await ensureNotificationReferenceColumns(pool);
      const result = await pool.query(
        "SELECT * FROM notifications WHERE participant_id = $1 ORDER BY created_at DESC LIMIT 20",
        [participantId]
      );
      res.json(result.rows);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/parent/homework", async (req, res) => {
    if (!pool) return res.json([]);
    const participantId = await getParentParticipantId(req);
    if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

    try {
      const result = await pool.query(`
        SELECT
          hap.id as assignment_participant_id,
          hap.status,
          hap.diary_entries,
          hap.total_minutes,
          hap.parent_comment,
          hap.coach_feedback,
          hap.points_awarded,
          hap.submitted_at,
          hap.reviewed_at,
          hap.updated_at as submission_updated_at,
          ha.id as assignment_id,
          ha.title,
          ha.description,
          ha.focus,
          ha.difficulty,
          ha.estimated_minutes,
          ha.due_date,
          ha.exercises,
          ha.created_at,
          g.name as group_name,
          c.name as coach_name
        FROM homework_assignment_participants hap
        JOIN homework_assignments ha ON hap.assignment_id = ha.id
        LEFT JOIN groups g ON ha.group_id = g.id
        LEFT JOIN coaches c ON ha.coach_id = c.id
        WHERE hap.participant_id = $1
          AND ha.status = 'active'
        ORDER BY
          CASE hap.status WHEN 'needs_work' THEN 0 WHEN 'assigned' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'submitted' THEN 3 ELSE 4 END,
          ha.due_date ASC NULLS LAST,
          ha.created_at DESC
      `, [participantId]);
      res.json(result.rows);
    } catch (e) {
      console.error("Failed to fetch parent homework:", e);
      res.status(500).json({ error: "Failed to fetch homework" });
    }
  });

  app.put("/api/parent/homework/:id", async (req, res) => {
    if (!pool) return res.status(500).json({ error: "Database not configured" });
    const participantId = await getParentParticipantId(req);
    if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

    const status = String(req.body?.status) === 'submitted' ? 'submitted' : 'in_progress';
    const diaryEntries = Array.isArray(req.body?.diary_entries) ? req.body.diary_entries : [];
    const safeDiaryEntries = diaryEntries.slice(0, 20).map((entry: any, index: number) => ({
      exercise_id: String(entry?.exercise_id || `entry_${index + 1}`),
      exercise_name: String(entry?.exercise_name || '').trim().slice(0, 160),
      sets_done: Math.max(0, Math.min(50, Number(entry?.sets_done) || 0)),
      reps_done: String(entry?.reps_done || '').trim().slice(0, 80),
      minutes: Math.max(0, Math.min(180, Number(entry?.minutes) || 0)),
      note: String(entry?.note || '').trim().slice(0, 500)
    }));
    const totalMinutes = Math.max(0, Math.min(240, Number(req.body?.total_minutes) || safeDiaryEntries.reduce((sum: number, entry: any) => sum + Number(entry.minutes || 0), 0)));
    const parentComment = String(req.body?.parent_comment || '').trim().slice(0, 1200);

    try {
      const check = await pool.query(
        "SELECT id FROM homework_assignment_participants WHERE id = $1 AND participant_id = $2",
        [req.params.id, participantId]
      );
      if (check.rows.length === 0) return res.status(404).json({ error: "Homework not found" });

      const result = await pool.query(`
        UPDATE homework_assignment_participants
        SET diary_entries = $1::jsonb,
            total_minutes = $2,
            parent_comment = $3,
            status = $4,
            submitted_at = CASE WHEN $4 = 'submitted' THEN CURRENT_TIMESTAMP ELSE submitted_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND participant_id = $6
        RETURNING *
      `, [
        JSON.stringify(safeDiaryEntries),
        totalMinutes,
        parentComment,
        status,
        req.params.id,
        participantId
      ]);

      res.json(result.rows[0]);
    } catch (e) {
      console.error("Failed to update parent homework:", e);
      res.status(500).json({ error: "Failed to update homework" });
    }
  });

  app.get("/api/parent/me", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
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
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (!familyIds.includes(participantId)) {
          return res.status(404).json({ error: "Participant not found" });
        }

        const childrenRes = await pool.query(`
          SELECT
            p.id, p.name, p.age, p.belt, p.rank_points, p.payment_status, p.streak, p.exam_readiness,
            g.name as group_name,
            (SELECT status FROM attendance WHERE participant_id = p.id AND date = CURRENT_DATE LIMIT 1) as today_status,
            (SELECT COUNT(*) FROM attendance WHERE participant_id = p.id AND status = 'present') as total_attendance
          FROM participants p
          LEFT JOIN groups g ON p.group_id = g.id
          WHERE p.id = ANY($1::int[])
          ORDER BY p.name ASC
        `, [familyIds]);
        res.json(childrenRes.rows);
      } catch (e) {
        console.error('Fetch children error:', e);
        res.status(500).json({ error: "Failed to fetch children" });
      }
    });

    app.post("/api/parent/absence-confirm", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
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
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in" });

      try {
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (familyIds.includes(Number(childId))) {
          (req.session as any).participantId = childId;
          return req.session.save(() => {
            res.json({ success: true, token: createAuthToken({ id: childId, role: 'parent' }) });
          });
        }
        res.status(403).json({ error: "Forbidden" });
      } catch (e) {
        res.status(500).json({ error: "Failed to switch child" });
      }
    });

    app.get("/api/parent/attendance", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
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
      const participantId = await getParentParticipantId(req);
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
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const result = await pool.query("SELECT * FROM badges WHERE participant_id = $1 ORDER BY date DESC", [participantId]);
        res.json(result.rows);
      } catch (e) {
        res.status(500).json({ error: "Failed to fetch badges" });
      }
    });

    app.get("/api/parent/events", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (familyIds.length === 0) return res.json([]);

        const result = await pool.query(`
          SELECT
            c.*,
            p.name as participant_name,
            COALESCE(pl.points, 0) as points_awarded
          FROM competitions c
          JOIN participants p ON c.participant_id = p.id
          LEFT JOIN points_log pl ON pl.reference_id = 'comp_' || c.id::text
          WHERE c.participant_id = ANY($1::int[])
          ORDER BY c.date DESC NULLS LAST, c.id DESC
          LIMIT 50
        `, [familyIds]);
        res.json(result.rows);
      } catch (e) {
        console.error("Failed to fetch parent events:", e);
        res.status(500).json({ error: "Failed to fetch events" });
      }
    });

    app.get("/api/parent/points-log", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (familyIds.length === 0) return res.json([]);

        const result = await pool.query(`
          SELECT pl.*, p.name as participant_name
          FROM points_log pl
          JOIN participants p ON pl.participant_id = p.id
          WHERE pl.participant_id = ANY($1::int[])
          ORDER BY pl.date DESC NULLS LAST, pl.created_at DESC
          LIMIT 60
        `, [familyIds]);
        res.json(result.rows);
      } catch (e) {
        console.error("Failed to fetch parent points log:", e);
        res.status(500).json({ error: "Failed to fetch points log" });
      }
    });

    app.get("/api/parent/coach-notes", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (familyIds.length === 0) return res.json([]);

        const result = await pool.query(`
          SELECT cn.*, p.name as participant_name, c.name as coach_name
          FROM coach_notes cn
          JOIN participants p ON cn.participant_id = p.id
          LEFT JOIN coaches c ON cn.coach_id = c.id
          WHERE cn.participant_id = ANY($1::int[])
          AND cn.visibility IN ('parent', 'public')
          ORDER BY cn.created_at DESC
          LIMIT 30
        `, [familyIds]);
        res.json(result.rows);
      } catch (e) {
        console.error("Failed to fetch parent coach notes:", e);
        res.status(500).json({ error: "Failed to fetch coach notes" });
      }
    });

    app.get("/api/parent/ratings", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
      if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

      try {
        const participantRes = await pool.query("SELECT id, group_id FROM participants WHERE id = $1", [participantId]);
        if (participantRes.rows.length === 0) return res.status(404).json({ error: "Participant not found" });

        const groupId = participantRes.rows[0].group_id;
        const familyIds = await getParentFamilyParticipantIds(participantId);
        if (!groupId) {
          return res.json({ bestAthlete: null, currentChild: null, groupTop: [], family: [] });
        }

        const ratingsRes = await pool.query(`
          WITH scored AS (
            SELECT
              p.id,
              p.name,
              p.belt,
              p.rank_points,
              g.name as group_name,
              l.name as location_name,
              GREATEST(
                COALESCE((SELECT SUM(points) FROM points_log pl WHERE pl.participant_id = p.id), 0),
                COALESCE(p.rank_points, 0)
              )::int as total_points,
              COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.participant_id = p.id AND a.status = 'present'), 0)::int as attendance_count,
              COALESCE((SELECT SUM(points) FROM points_log pl WHERE pl.participant_id = p.id AND pl.reason = 'homework'), 0)::int as homework_points,
              COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id AND hap.status = 'approved'), 0)::int as homework_approved_count,
              COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0)::int as homework_assigned_count,
              CASE
                WHEN COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0) = 0 THEN 0
                ELSE ROUND(
                  COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id AND hap.status = 'approved'), 0)::numeric * 100 /
                  NULLIF((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0)
                )::int
              END as homework_completion_rate,
              COALESCE((SELECT COUNT(*) FROM competitions c WHERE c.participant_id = p.id AND c.type = 'seminar'), 0)::int as seminar_count,
              COALESCE((SELECT COUNT(*) FROM competitions c WHERE c.participant_id = p.id AND c.type = 'competition'), 0)::int as competition_count
            FROM participants p
            LEFT JOIN groups g ON p.group_id = g.id
            LEFT JOIN locations l ON g.location_id = l.id
            WHERE p.group_id = $1
            AND p.status = 'active'
          ),
          ranked AS (
            SELECT
              *,
              ROW_NUMBER() OVER (ORDER BY total_points DESC, homework_points DESC, attendance_count DESC, name ASC) as rank_position
            FROM scored
          )
          SELECT * FROM ranked
          ORDER BY rank_position ASC
          LIMIT 30
        `, [groupId]);

        const familyRes = familyIds.length > 0 ? await pool.query(`
          WITH scored AS (
            SELECT
              p.id,
              p.name,
              p.belt,
              g.name as group_name,
              GREATEST(
                COALESCE((SELECT SUM(points) FROM points_log pl WHERE pl.participant_id = p.id), 0),
                COALESCE(p.rank_points, 0)
              )::int as total_points,
              COALESCE((SELECT COUNT(*) FROM attendance a WHERE a.participant_id = p.id AND a.status = 'present'), 0)::int as attendance_count,
              COALESCE((SELECT SUM(points) FROM points_log pl WHERE pl.participant_id = p.id AND pl.reason = 'homework'), 0)::int as homework_points,
              COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id AND hap.status = 'approved'), 0)::int as homework_approved_count,
              COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0)::int as homework_assigned_count,
              CASE
                WHEN COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0) = 0 THEN 0
                ELSE ROUND(
                  COALESCE((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id AND hap.status = 'approved'), 0)::numeric * 100 /
                  NULLIF((SELECT COUNT(*) FROM homework_assignment_participants hap WHERE hap.participant_id = p.id), 0)
                )::int
              END as homework_completion_rate
            FROM participants p
            LEFT JOIN groups g ON p.group_id = g.id
            WHERE p.id = ANY($1::int[])
          )
          SELECT * FROM scored
          ORDER BY total_points DESC, homework_points DESC, attendance_count DESC, name ASC
        `, [familyIds]) : { rows: [] };

        const currentChild = ratingsRes.rows.find((row: any) => Number(row.id) === Number(participantId)) || null;
        res.json({
          bestAthlete: ratingsRes.rows[0] || null,
          currentChild,
          groupTop: ratingsRes.rows,
          family: familyRes.rows
        });
      } catch (e) {
        console.error("Failed to fetch parent ratings:", e);
        res.status(500).json({ error: "Failed to fetch ratings" });
      }
    });

    app.get("/api/parent/schedule", async (req, res) => {
      if (!pool) return res.status(500).json({ error: "Database not configured" });
      const participantId = await getParentParticipantId(req);
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
          SELECT s.*, c.name as coach_name, l.name as location_name, l.address as location_address, l.map_link as location_map_link
          FROM schedule s
          LEFT JOIN coaches c ON s.coach_id = c.id
          LEFT JOIN locations l ON s.location_id = l.id
          WHERE s.group_name IS NOT NULL
            AND (
              LOWER(TRIM(s.group_name)) = LOWER(TRIM($1))
              OR LOWER(TRIM(s.group_name)) LIKE LOWER(TRIM($1)) || ' %'
              OR LOWER(TRIM(s.group_name)) LIKE LOWER(TRIM($1)) || '(%'
              OR LOWER(TRIM($1)) LIKE LOWER(TRIM(s.group_name)) || ' %'
              OR LOWER(TRIM($1)) LIKE LOWER(TRIM(s.group_name)) || '(%'
            )
            AND ($2::int IS NULL OR s.location_id = $2::int)
            AND ($3::int IS NULL OR s.coach_id = $3::int OR s.coach_id IS NULL)
          ORDER BY s.order_index ASC, s.start_time ASC
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
        const participantId = await getParentParticipantId(req);
        if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

        const result = await pool.query(
          `SELECT id, name as first_name, belt as belt_level, updated_at as belt_updated_at
           FROM participants
           WHERE parent_login = (SELECT parent_login FROM participants WHERE id = $1)
           OR id = $1
           ORDER BY name ASC`,
          [participantId]
        );
        res.json({ children: result.rows });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/parent/:parentId/attendance-streak', async (req, res) => {
      try {
        const participantId = await getParentParticipantId(req);
        if (!participantId) return res.status(401).json({ error: "Not logged in as parent" });

        const result = await pool.query(
          `SELECT p.id, p.name as first_name, COUNT(a.id) as total_attendance
           FROM participants p
           LEFT JOIN attendance a ON p.id = a.participant_id AND a.date >= NOW() - INTERVAL '30 days'
           WHERE p.parent_login = (SELECT parent_login FROM participants WHERE id = $1) OR p.id = $1
           GROUP BY p.id, p.name ORDER BY p.name ASC`,
          [participantId]
        );
        res.json({ children: result.rows });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // ===== COACH ROUTES =====
    app.post('/api/coach/attendance/bulk', requireAuth, async (req, res) => {
      try {
        const user = (req as any).user;
        const { attendance_records } = req.body; // [{participant_id, date, status}]
        if (!Array.isArray(attendance_records)) {
          return res.status(400).json({ error: "attendance_records must be an array" });
        }

        if (user?.role === 'coach' && user.coach_id && attendance_records.length > 0) {
          const participantIds = [...new Set(attendance_records.map((record: any) => Number(record.participant_id)).filter(Boolean))];
          const scopeResult = await pool.query(
            `SELECT COUNT(DISTINCT p.id)::int AS count
             FROM participants p
             LEFT JOIN groups g ON p.group_id = g.id
             WHERE p.id = ANY($1::int[]) AND g.coach_id = $2`,
            [participantIds, user.coach_id]
          );
          if (scopeResult.rows[0]?.count !== participantIds.length) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }

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

    app.post('/api/coach/notes/:participantId', requireAuth, async (req, res) => {
      try {
        const user = (req as any).user;
        const { participantId } = req.params;
        const { note, date } = req.body;
        if (user?.role === 'coach' && user.coach_id) {
          const scopeResult = await pool.query(
            `SELECT p.id
             FROM participants p
             LEFT JOIN groups g ON p.group_id = g.id
             WHERE p.id = $1 AND g.coach_id = $2`,
            [participantId, user.coach_id]
          );
          if (scopeResult.rows.length === 0) {
            return res.status(403).json({ error: "Forbidden" });
          }
        }
        const result = await pool.query(
          `INSERT INTO coach_notes (participant_id, coach_id, content, visibility)
           VALUES ($1, $2, $3, 'parent')
           RETURNING *`,
          [participantId, user?.coach_id || null, note]
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

