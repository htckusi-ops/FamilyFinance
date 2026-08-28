const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/familyfinance.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent','child')),
      photo TEXT,
      pin_required INTEGER DEFAULT 0,
      pin_hash TEXT,
      password_hash TEXT,
      color TEXT DEFAULT '#4F86C6',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      balance REAL DEFAULT 0,
      savings_balance REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      receipt_photo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      image TEXT,
      achieved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS allowance_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      amount REAL DEFAULT 0,
      interval TEXT DEFAULT 'monthly' CHECK(interval IN ('weekly','monthly')),
      next_payout_at TEXT,
      interest_rate REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER DEFAULT 0,
      streak_weeks INTEGER DEFAULT 0,
      last_job_week TEXT
    );

    CREATE TABLE IF NOT EXISTS point_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      description TEXT,
      mini_job_id INTEGER REFERENCES mini_jobs(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mini_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT DEFAULT 'manual' CHECK(recurrence IN ('manual','daily','weekly')),
      job_type TEXT DEFAULT 'extra' CHECK(job_type IN ('duty','extra')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points_required INTEGER NOT NULL,
      image TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reward_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      claimed_at TEXT DEFAULT (datetime('now')),
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      earned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_id)
    );

    CREATE TABLE IF NOT EXISTS flea_market_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS flea_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_id INTEGER REFERENCES flea_market_days(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      barcode TEXT,
      photo TEXT,
      category TEXT DEFAULT 'Sonstiges',
      condition TEXT DEFAULT 'gut',
      suggested_price REAL DEFAULT 0,
      sold_price REAL,
      status TEXT DEFAULT 'available' CHECK(status IN ('available','sold','unsold')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS flea_item_owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flea_item_id INTEGER NOT NULL REFERENCES flea_items(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_percent REAL DEFAULT 100,
      UNIQUE(flea_item_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notification_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      telegram_chat_id TEXT,
      events TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      size_bytes INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS family_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS bath_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bath_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      bath_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Live migrations for existing databases
  try { db.exec('ALTER TABLE mini_jobs ADD COLUMN job_type TEXT DEFAULT "extra"'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN age_group TEXT DEFAULT "school"'); } catch {}
  try { db.exec('ALTER TABLE mini_jobs ADD COLUMN image TEXT'); } catch {}
  try { db.exec("ALTER TABLE flea_items ADD COLUMN sold_type TEXT DEFAULT 'cash'"); } catch {}
  try { db.exec('ALTER TABLE rewards ADD COLUMN require_all INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE notification_config ADD COLUMN signal_recipient TEXT'); } catch {}
  try { db.exec('ALTER TABLE notification_config ADD COLUMN threema_to_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN birthdate TEXT'); } catch {}
  try { db.exec('ALTER TABLE allowance_config ADD COLUMN allow_self_transfer_to_savings INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE allowance_config ADD COLUMN allow_self_transfer_from_savings INTEGER DEFAULT 0'); } catch {}
  try { db.exec("ALTER TABLE allowance_config ADD COLUMN interest_interval TEXT DEFAULT 'monthly'"); } catch {}
  try { db.exec('ALTER TABLE allowance_config ADD COLUMN next_interest_at TEXT'); } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS media_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    daily_limit_minutes INTEGER DEFAULT 60,
    weekly_limit_minutes INTEGER DEFAULT 300,
    warn_before_minutes INTEGER DEFAULT 2,
    active_half_count INTEGER DEFAULT 0
  )`);
  } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS media_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    duration_minutes REAL,
    category TEXT DEFAULT 'passive' CHECK(category IN ('passive','active')),
    notes TEXT
  )`);
  } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS media_session_users (
    session_id INTEGER NOT NULL REFERENCES media_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (session_id, user_id)
  )`);
  } catch {}
  try { db.exec('ALTER TABLE media_sessions ADD COLUMN session_limit_minutes REAL'); } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS media_manual_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      delta_minutes REAL NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch {}
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS reward_targets (
      reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      PRIMARY KEY (reward_id, user_id)
    )`);
  } catch {}
  // Streak-Freeze: 1 kostenloser Freeze pro Monat (pädagogisch: Resilienz statt Scham bei Ausfall)
  try { db.exec('ALTER TABLE points ADD COLUMN streak_freeze INTEGER DEFAULT 1'); } catch {}
  try { db.exec('ALTER TABLE points ADD COLUMN streak_freeze_month TEXT'); } catch {}
  // V5: Wochenende-Limit für Medienzeit (AWMF: Wochenenden können grosszügiger sein)
  try { db.exec('ALTER TABLE media_config ADD COLUMN daily_limit_weekend_minutes INTEGER'); } catch {}
  // V6: Reflexion nach Ausgaben (EU/OECD: financial attitudes)
  try { db.exec('ALTER TABLE transactions ADD COLUMN reflection TEXT'); } catch {}
  // V8: Qualitäts-Tagging für Medienzeit-Sessions (AAP: quality over quantity)
  try { db.exec('ALTER TABLE media_sessions ADD COLUMN quality_tag TEXT'); } catch {}

  seedBadges();
  seedDefaultAdmin();
  seedDefaultSettings();
  seedDefaultJobs();
}

function seedDefaultJobs() {
  const count = db.prepare('SELECT COUNT(*) as c FROM mini_jobs').get().c;
  if (count > 0) return; // nur bei frischer DB

  const duties = [
    { name: 'Bett machen',           points: 0,  recurrence: 'daily',  image: '🛏️' },
    { name: 'Zimmer aufräumen',       points: 0,  recurrence: 'weekly', image: '🧹' },
    { name: 'Tisch decken / abräumen',points: 0,  recurrence: 'daily',  image: '🍽️' },
    { name: 'Hausaufgaben erledigen', points: 0,  recurrence: 'daily',  image: '📚' },
    { name: 'Zähne putzen',           points: 0,  recurrence: 'daily',  image: '🦷' },
    { name: 'Wäsche zusammenlegen',   points: 0,  recurrence: 'weekly', image: '👕' },
    { name: 'Tier füttern',           points: 0,  recurrence: 'daily',  image: '🐾' },
  ];
  const extras = [
    { name: 'Auto waschen',           points: 15, recurrence: 'manual', image: '🚗' },
    { name: 'Einkaufen helfen',        points: 10, recurrence: 'manual', image: '🛒' },
    { name: 'Garten helfen',           points: 10, recurrence: 'manual', image: '🌿' },
    { name: 'Fenster putzen',          points: 12, recurrence: 'manual', image: '🪟' },
    { name: 'Keller aufräumen',        points: 15, recurrence: 'manual', image: '📦' },
    { name: 'Badezimmer putzen',       points: 12, recurrence: 'manual', image: '🧽' },
    { name: 'Kochen helfen',           points: 8,  recurrence: 'manual', image: '🍳' },
    { name: 'Geschwister betreuen',    points: 10, recurrence: 'manual', image: '👶' },
    { name: 'Schnee schaufeln',        points: 15, recurrence: 'manual', image: '❄️' },
    { name: 'Rasenmähen',              points: 15, recurrence: 'manual', image: '🌱' },
  ];

  const ins = db.prepare('INSERT INTO mini_jobs (name,points,recurrence,job_type,image) VALUES (?,?,?,?,?)');
  for (const j of duties) ins.run(j.name, j.points, j.recurrence, 'duty', j.image);
  for (const j of extras) ins.run(j.name, j.points, j.recurrence, 'extra', j.image);
}

function seedDefaultSettings() {
  const defaults = {
    show_streak: 'true',
    show_badges: 'true',
    interest_visible_age: '10',
    duty_jobs_label: 'Haushaltspflichten',
    extra_jobs_label: 'Extra-Jobs',
    currency: 'CHF',
    point_value_chf: '0.10',
    media_reset_hour: '0',
    media_week_start_day: '1',
  };
  const ins = db.prepare('INSERT OR IGNORE INTO family_settings (key, value) VALUES (?,?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

function seedBadges() {
  const badges = [
    { key: 'first_save',     name: 'Erstes Sparziel',    icon: '🐷', description: 'Du hast dein erstes Sparziel gesetzt — das zeigt, dass du weisst, wofür du sparst. Das ist der wichtigste Schritt zum Sparen!' },
    { key: 'goal_reached',   name: 'Sparziel erreicht!', icon: '🏆', description: 'Du hast ein Sparziel vollständig erreicht. Das beweist: Geduld und Plan zahlen sich aus — eine Fähigkeit, die fürs ganze Leben gilt.' },
    { key: 'first_job',      name: 'Erster Mini-Job',    icon: '⭐', description: 'Du hast deinen ersten Extra-Job erledigt und gezeigt, dass du Verantwortung übernehmen kannst. Gut gemacht!' },
    { key: 'five_jobs',      name: 'Fleissige Biene',    icon: '🐝', description: 'Schon 5 Extra-Jobs erledigt! Du hast gelernt, dass regelmässiger Einsatz sich lohnt — genau wie im echten Arbeitsleben.' },
    { key: 'twenty_jobs',    name: 'Jobprofi',            icon: '💼', description: '20 Extra-Jobs — das ist echte Ausdauer! Du hast bewiesen, dass du zuverlässig und engagiert bist. Das schätzen Menschen in jeder Lebenslage.' },
    { key: 'streak_2',       name: '2 Wochen Serie',     icon: '🔥', description: '2 Wochen in Folge dabei geblieben! Regelmässigkeit ist eine Superkraft — wer durchhält, erreicht mehr als wer nur manchmal Gas gibt.' },
    { key: 'streak_4',       name: 'Monatsheld',         icon: '🦸', description: '4 Wochen am Stück aktiv! Du hast gelernt, was Routine bedeutet — und dass aus kleinen Schritten grosse Leistungen werden.' },
    { key: 'flea_first_item',name: 'Flohmarkt-Starter',  icon: '🏷️', description: 'Du hast deinen ersten Artikel für den Flohmarkt erfasst und einen Preis gesetzt. Das ist echter Unternehmersinn — du denkst darüber nach, was Dinge wert sind.' },
    { key: 'flea_first_sale',name: 'Flohmarkt-Profi',    icon: '💰', description: 'Ersten Artikel verkauft! Du hast gelernt: Etwas, das du nicht mehr brauchst, hat für andere noch Wert. Das ist Wirtschaft im Kleinen — und Nachhaltigkeit dazu.' },
    { key: 'first_reward',   name: 'Belohnung eingelöst',icon: '🎁', description: 'Erste Belohnung erhalten! Du hast Punkte gesammelt und dann entschieden, wann der richtige Moment zum Einlösen ist — das nennt man Impulskontrolle.' },
    { key: 'saver_100',      name: 'Sparfuchs',          icon: '🦊', description: 'CHF 100 gespart! Das ist eine echte Leistung. Du hast bewiesen, dass du auch auf kurzfristige Wünsche verzichten kannst, wenn du ein grösseres Ziel vor Augen hast.' },
  ];

  const upsert = db.prepare(
    'INSERT INTO badges (key, name, description, icon) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET name=excluded.name, description=excluded.description, icon=excluded.icon'
  );
  for (const b of badges) upsert.run(b.key, b.name, b.description, b.icon);
}

function seedDefaultAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('parent');
  if (!existing) {
    const hash = bcrypt.hashSync('admin', 10);
    const user = db.prepare(
      "INSERT INTO users (name, role, password_hash) VALUES ('Admin', 'parent', ?)"
    ).run(hash);
    db.prepare('INSERT INTO accounts (user_id) VALUES (?)').run(user.lastInsertRowid);
    db.prepare('INSERT INTO points (user_id) VALUES (?)').run(user.lastInsertRowid);
    db.prepare('INSERT INTO allowance_config (user_id) VALUES (?)').run(user.lastInsertRowid);
    console.log('Default admin created: username=Admin password=admin');
  }
}

migrate();

module.exports = db;
