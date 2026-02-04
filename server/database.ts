import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// When running with tsx, __dirname is the source directory
// When running compiled, it's dist/server - handle both cases
const projectRoot = __dirname.includes('dist')
  ? path.join(__dirname, '..', '..')
  : path.join(__dirname, '..');

const dataDir = path.join(projectRoot, 'data');
const DB_PATH = path.join(dataDir, 'hobbit.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initializeDatabase(): void {
  const database = getDb();

  // Accounts & Players
  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      current_room TEXT DEFAULT 'bag_end_garden',
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      gold INTEGER DEFAULT 5,
      -- Condition stats (0-100)
      cleanliness INTEGER DEFAULT 100,
      fatigue INTEGER DEFAULT 100,
      bloodiness INTEGER DEFAULT 0,
      wounds INTEGER DEFAULT 0,
      -- Timestamps for degradation
      last_condition_update DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS player_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      item_template_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    -- Player equipped items (KCD2-style slots)
    CREATE TABLE IF NOT EXISTS player_equipment (
      player_id INTEGER PRIMARY KEY,
      head INTEGER,
      neck INTEGER,
      body INTEGER,
      torso INTEGER,
      cloak INTEGER,
      hands INTEGER,
      legs INTEGER,
      feet INTEGER,
      main_hand INTEGER,
      off_hand INTEGER,
      ring INTEGER,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    -- Room state (items in rooms)
    CREATE TABLE IF NOT EXISTS room_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      item_template_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1
    );

    -- NPC instances in world
    CREATE TABLE IF NOT EXISTS room_npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      npc_template_id INTEGER NOT NULL,
      hp_current INTEGER
    );

    -- NPC dynamic state
    CREATE TABLE IF NOT EXISTS npc_state (
      npc_template_id INTEGER PRIMARY KEY,
      current_room TEXT NOT NULL,
      mood TEXT DEFAULT 'neutral',
      current_task TEXT,
      energy INTEGER DEFAULT 100,
      last_player_interaction DATETIME
    );

    -- NPC desires (dynamic, change over time)
    CREATE TABLE IF NOT EXISTS npc_desires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_template_id INTEGER NOT NULL,
      desire_type TEXT NOT NULL,
      desire_content TEXT NOT NULL,
      desire_reason TEXT,
      priority INTEGER DEFAULT 5,
      spawned_item_id INTEGER,
      spawned_room_id TEXT,
      fulfilled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- NPC feelings (compact context storage)
    CREATE TABLE IF NOT EXISTS npc_feelings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_template_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      trust INTEGER DEFAULT 50,
      affection INTEGER DEFAULT 50,
      social_capital INTEGER DEFAULT 0,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(npc_template_id, target_type, target_id)
    );

    -- NPC memories of interactions
    CREATE TABLE IF NOT EXISTS npc_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_template_id INTEGER NOT NULL,
      about_type TEXT NOT NULL,
      about_id INTEGER NOT NULL,
      memory_content TEXT NOT NULL,
      importance INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Dynamic socials (player-created)
    CREATE TABLE IF NOT EXISTS custom_socials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      sentiment TEXT DEFAULT 'neutral',
      no_target_self TEXT NOT NULL,
      no_target_others TEXT NOT NULL,
      with_target_self TEXT NOT NULL,
      with_target_target TEXT NOT NULL,
      with_target_others TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      usage_count INTEGER DEFAULT 0
    );

    -- Follow relationships
    CREATE TABLE IF NOT EXISTS follow_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_type TEXT NOT NULL,
      follower_id INTEGER NOT NULL,
      leader_type TEXT NOT NULL,
      leader_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_type, follower_id)
    );

    -- Spawned quest items
    CREATE TABLE IF NOT EXISTS spawned_quest_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_template_id INTEGER NOT NULL,
      room_id TEXT NOT NULL,
      spawned_for_npc_id INTEGER NOT NULL,
      desire_id INTEGER,
      spawned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      claimed_at DATETIME
    );

    -- Game time
    CREATE TABLE IF NOT EXISTS game_time (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hour INTEGER DEFAULT 10,
      day INTEGER DEFAULT 1,
      month INTEGER DEFAULT 4,
      year INTEGER DEFAULT 2941
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_player_inventory_player ON player_inventory(player_id);
    CREATE INDEX IF NOT EXISTS idx_room_items_room ON room_items(room_id);
    CREATE INDEX IF NOT EXISTS idx_npc_desires_npc ON npc_desires(npc_template_id);
    CREATE INDEX IF NOT EXISTS idx_npc_feelings_npc ON npc_feelings(npc_template_id);
    CREATE INDEX IF NOT EXISTS idx_npc_memories_npc ON npc_memories(npc_template_id);
    CREATE INDEX IF NOT EXISTS idx_follow_leader ON follow_relationships(leader_type, leader_id);
  `);

  // Initialize game time if not exists
  const timeExists = database.prepare('SELECT 1 FROM game_time WHERE id = 1').get();
  if (!timeExists) {
    database.prepare('INSERT INTO game_time (id, hour, day, month, year) VALUES (1, 10, 1, 4, 2941)').run();
  }

  // Apply migrations for existing databases
  applyMigrations(database);

  console.log('Database initialized successfully');
}

// Apply migrations for new columns/tables
function applyMigrations(database: Database.Database): void {
  // Check if players table has cleanliness column
  const playerColumns = database.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  const hasCleanlinessCol = playerColumns.some(col => col.name === 'cleanliness');

  if (!hasCleanlinessCol) {
    console.log('Applying migration: adding condition columns to players table');
    // SQLite doesn't allow non-constant defaults in ALTER TABLE, so we add without default
    // and then update existing rows
    database.exec(`
      ALTER TABLE players ADD COLUMN cleanliness INTEGER DEFAULT 100;
      ALTER TABLE players ADD COLUMN fatigue INTEGER DEFAULT 100;
      ALTER TABLE players ADD COLUMN bloodiness INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN wounds INTEGER DEFAULT 0;
      ALTER TABLE players ADD COLUMN last_condition_update DATETIME;
    `);
    // Update existing rows with current timestamp
    database.exec(`UPDATE players SET last_condition_update = datetime('now') WHERE last_condition_update IS NULL;`);
  }

  // Check if last_condition_update column exists (partial migration fix)
  const hasLastConditionUpdate = playerColumns.some(col => col.name === 'last_condition_update');
  if (!hasLastConditionUpdate && hasCleanlinessCol) {
    console.log('Applying migration: adding last_condition_update column');
    database.exec(`ALTER TABLE players ADD COLUMN last_condition_update DATETIME;`);
    database.exec(`UPDATE players SET last_condition_update = datetime('now') WHERE last_condition_update IS NULL;`);
  }

  // Check if player_equipment table exists
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='player_equipment'").get();
  if (!tables) {
    console.log('Applying migration: creating player_equipment table');
    database.exec(`
      CREATE TABLE IF NOT EXISTS player_equipment (
        player_id INTEGER PRIMARY KEY,
        head INTEGER,
        neck INTEGER,
        body INTEGER,
        torso INTEGER,
        cloak INTEGER,
        hands INTEGER,
        legs INTEGER,
        feet INTEGER,
        main_hand INTEGER,
        off_hand INTEGER,
        ring INTEGER,
        FOREIGN KEY (player_id) REFERENCES players(id)
      );
    `);
  }
}

// Run initialization if this file is executed directly
if (require.main === module) {
  initializeDatabase();
}

export default { getDb, initializeDatabase };
