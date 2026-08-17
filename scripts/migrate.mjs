#!/usr/bin/env node
// Run database migrations using the existing backend/src/migrations.sql.
// Uses the `postgres` package (already a runtime dependency of the main app).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.resolve(__dirname, "..", "backend", "src", "migrations.sql");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!fs.existsSync(SQL_PATH)) {
  console.error(`migrations.sql not found at ${SQL_PATH}`);
  process.exit(1);
}

const sqlText = fs.readFileSync(SQL_PATH, "utf8");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  console.log(`[migrate] applying ${SQL_PATH} …`);
  await sql.unsafe(sqlText);
  console.log("[migrate] done.");
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
