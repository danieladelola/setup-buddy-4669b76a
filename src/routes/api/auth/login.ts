import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Rate-limit windows tuned for honest users + bot defence.
// Per-IP: 10 attempts / 5 min. Per-email: 5 attempts / 15 min.
const IP_LIMIT = { limit: 10, windowMs: 5 * 60_000 };
const EMAIL_LIMIT = { limit: 5, windowMs: 15 * 60_000 };

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { signToken } = await import("@/lib/auth.server");
        const { checkRateLimit, clientIp, rateLimitResponse } = await import(
          "@/lib/rate-limit.server"
        );
        const bcrypt = (await import("bcryptjs")).default;

        const body = await request.json().catch(() => null);
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const { email, password } = parsed.data;
        const emailNorm = email.toLowerCase();
        const ip = clientIp(request);

        // 1) IP gate — blunt brute force / credential stuffing.
        const ipGate = checkRateLimit(`login:ip:${ip}`, IP_LIMIT);
        if (!ipGate.ok) {
          return rateLimitResponse(
            ipGate,
            JSON.stringify({ error: "Too many attempts. Try again later." }),
          );
        }

        // 2) Per-email gate — defend against distributed attacks on one account.
        // Always checked, even for unknown emails, so the response shape can't
        // disclose whether the email exists.
        const emailGate = checkRateLimit(`login:email:${emailNorm}`, EMAIL_LIMIT);
        if (!emailGate.ok) {
          return rateLimitResponse(
            emailGate,
            JSON.stringify({ error: "Too many attempts. Try again later." }),
          );
        }

        try {
          const sql = db();
          const rows = await sql<
            { id: string; email: string; password_hash: string; name: string | null }[]
          >`SELECT id, email, password_hash, name FROM admin_users WHERE email = ${emailNorm}`;
          const user = rows[0];
          if (!user) {
            // Constant-time-ish: still run a bcrypt compare against a dummy hash
            // so timing doesn't disclose account existence.
            await bcrypt.compare(
              password,
              "$2a$12$CwTycUXWue0Thq9StjUM0uJ8eVpQ3VqM/zV5pH8d2K7nQqLm6QzZi",
            );
            return Response.json({ error: "Invalid credentials" }, { status: 401 });
          }
          const ok = await bcrypt.compare(password, user.password_hash);
          if (!ok) {
            return Response.json({ error: "Invalid credentials" }, { status: 401 });
          }
          const token = await signToken({ id: user.id, email: user.email });
          try {
            const { audit } = await import("@/lib/audit.server");
            await audit({ id: user.id, email: user.email }, { action: "auth.login" }, request);
          } catch {}
          return Response.json({
            token,
            user: { id: user.id, email: user.email, name: user.name },
          });
        } catch (err) {
          console.error("login error", err);
          return Response.json({ error: "Login failed" }, { status: 500 });
        }
      },
    },
  },
});
