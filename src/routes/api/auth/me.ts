import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { db } = await import("@/lib/db.server");
        const { verifyToken } = await import("@/lib/auth.server");

        const h = request.headers.get("authorization") || "";
        const token = h.startsWith("Bearer ") ? h.slice(7) : "";
        if (!token) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const payload = await verifyToken(token);
          const userId = payload.id as string | undefined;
          if (!userId) {
            return Response.json({ error: "Invalid token" }, { status: 401 });
          }
          const sql = db();
          const rows = await sql<
            { id: string; email: string; name: string | null }[]
          >`SELECT id, email, name FROM admin_users WHERE id = ${userId}`;
          return Response.json({ user: rows[0] || null });
        } catch {
          return Response.json({ error: "Invalid token" }, { status: 401 });
        }
      },
    },
  },
});
