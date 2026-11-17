import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
const file = process.env.DB_PATH || "data/game.sqlite";
const dir = path.join(path.dirname(file), "backups");
mkdirSync(dir, { recursive: true });
const db = new Database(file, { fileMustExist: true });
const dest = path.join(
  dir,
  "game-" + new Date().toISOString().replace(/[:.]/g, "-") + ".sqlite",
);
try {
  await db.backup(dest);
  const restored = new Database(dest, { readonly: true });
  const ok = restored.pragma("integrity_check", { simple: true });
  const count = restored.prepare("SELECT count(*) n FROM characters").get().n;
  restored.close();
  if (ok !== "ok") throw Error("Backup integrity check failed");
  console.log(`Backup verified: ${dest} (${count} characters)`);
} finally {
  db.close();
}
