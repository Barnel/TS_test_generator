import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), process.env.TESTFORGE_DB_PATH ?? "testforge.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
    if (dbInstance) return dbInstance;
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS test_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repository_url TEXT NOT NULL,
            pull_request_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            branch_name TEXT,
            error TEXT,
            files_processed INTEGER NOT NULL DEFAULT 0,
            files_committed INTEGER NOT NULL DEFAULT 0,
            coverage_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (request_id) REFERENCES test_requests(id)
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    `);
    dbInstance = db;
    return db;
}
