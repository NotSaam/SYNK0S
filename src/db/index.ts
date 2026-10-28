import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

/** Crea una conexión y aplica las migraciones pendientes. */
export function createDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}

const g = globalThis as unknown as { __synk0sDb?: DB };

/** Conexión compartida (un singleton por proceso, sobrevive al hot reload). */
export function getDb(): DB {
  if (!g.__synk0sDb) {
    g.__synk0sDb = createDb(process.env.DATABASE_FILE ?? path.join(process.cwd(), "data", "synk0s.db"));
  }
  return g.__synk0sDb;
}

export { schema };
