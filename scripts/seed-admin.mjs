#!/usr/bin/env node
// Seed (or reset password for) the initial admin user.
// Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment.
import bcrypt from "bcryptjs";
import postgres from "postgres";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

try {
  const hash = await bcrypt.hash(password, 12);
  await sql`
    INSERT INTO admin_users (email, password_hash, name)
    VALUES (${email.toLowerCase()}, ${hash}, 'Admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
  console.log(`[seed-admin] admin seeded: ${email}`);
} catch (err) {
  console.error("[seed-admin] failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
