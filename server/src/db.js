import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, '..', 'data', 'custodysteps.db');

let impl = null; // 'better-sqlite3' | 'sql.js'
let db = null;
let SQL = null;
let persistPath = null;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL,
  step_id TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, step_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;

async function initBetterSqlite3(dbPath) {
  const Database = (await import('better-sqlite3')).default;
  ensureDir(dbPath);
  const connection = new Database(dbPath);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  connection.exec(SCHEMA);
  return {
    prepare(sql) {
      const stmt = connection.prepare(sql);
      return {
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params),
        run: (...params) => {
          const info = stmt.run(...params);
          return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        },
      };
    },
    exec(sql) {
      connection.exec(sql);
    },
  };
}

async function initSqlJs(dbPath) {
  const initSqlJs = (await import('sql.js')).default;
  SQL = await initSqlJs();
  ensureDir(dbPath);
  persistPath = dbPath;
  let connection;
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    connection = new SQL.Database(buf);
  } else {
    connection = new SQL.Database();
  }
  connection.run(SCHEMA);
  const persist = () => {
    const data = connection.export();
    fs.writeFileSync(persistPath, Buffer.from(data));
  };
  persist();
  return {
    prepare(sql) {
      return {
        get(...params) {
          const stmt = connection.prepare(sql);
          stmt.bind(params);
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        },
        all(...params) {
          const stmt = connection.prepare(sql);
          stmt.bind(params);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          return rows;
        },
        run(...params) {
          connection.run(sql, params);
          const changes = connection.getRowsModified();
          let lastInsertRowid = 0;
          try {
            const r = connection.exec('SELECT last_insert_rowid() AS id');
            if (r[0]?.values?.[0]?.[0] != null) lastInsertRowid = r[0].values[0][0];
          } catch {
            /* ignore */
          }
          persist();
          return { changes, lastInsertRowid };
        },
      };
    },
    exec(sql) {
      connection.run(sql);
      persist();
    },
  };
}

export async function getDb() {
  if (db) return db;
  const dbPath = process.env.DATABASE_PATH
    ? path.isAbsolute(process.env.DATABASE_PATH)
      ? process.env.DATABASE_PATH
      : path.join(__dirname, '..', process.env.DATABASE_PATH.replace(/^\.\//, ''))
    : defaultPath;

  try {
    db = await initBetterSqlite3(dbPath);
    impl = 'better-sqlite3';
    console.log(`[db] using better-sqlite3 at ${dbPath}`);
  } catch (err) {
    console.warn(`[db] better-sqlite3 unavailable (${err.message}); falling back to sql.js`);
    db = await initSqlJs(dbPath);
    impl = 'sql.js';
    console.log(`[db] using sql.js at ${dbPath}`);
  }
  return db;
}

export function getDbImpl() {
  return impl;
}
