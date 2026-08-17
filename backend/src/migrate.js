import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(__dirname, "migrations.sql"), "utf8");

const run = async () => {
  console.log("Running migrations...");
  await pool.query(sql);
  console.log("Done.");
  await pool.end();
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
