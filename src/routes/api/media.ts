import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per asset
const ALLOWED_PREFIX = "image/";

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { db } = await import("@/lib/db.server");
        const sql = db();
        const url = new URL(request.url);
        const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "60", 10)));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
        const [{ count }] = await sql`SELECT count(*)::int AS count FROM media_assets`;
        const rows = await sql`
          SELECT id, filename, mime_type, size_bytes, uploaded_by_email, created_at
          FROM media_assets
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;
        const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
        const data = rows.map((r: any) => ({
          ...r,
          url: `${appUrl}/api/public/media/${r.id}`,
        }));
        return json({ data, total: count, limit, offset });
      },

      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const form = await request.formData().catch(() => null);
        if (!form) return json({ error: "multipart form required" }, 400);
        const file = form.get("file");
        if (!(file instanceof File)) return json({ error: "file required" }, 400);
        if (!file.type || !file.type.startsWith(ALLOWED_PREFIX)) {
          return json({ error: "Only image uploads are allowed" }, 415);
        }
        if (file.size <= 0) return json({ error: "Empty file" }, 400);
        if (file.size > MAX_BYTES) return json({ error: "File exceeds 5 MB limit" }, 413);

        const buf = Buffer.from(await file.arrayBuffer());
        const filename = (file.name || "upload").slice(0, 255);

        const { db } = await import("@/lib/db.server");
        const sql = db();
        const rows = await sql`
          INSERT INTO media_assets (filename, mime_type, size_bytes, data, uploaded_by, uploaded_by_email)
          VALUES (${filename}, ${file.type}, ${file.size}, ${buf}, ${auth.id}, ${auth.email})
          RETURNING id, filename, mime_type, size_bytes, uploaded_by_email, created_at`;
        const row = rows[0];

        const { audit } = await import("@/lib/audit.server");
        await audit(auth, {
          action: "media.upload",
          entity_type: "media",
          entity_id: row.id,
          metadata: { filename, mime: file.type, size: file.size },
        }, request);

        const appUrl = (process.env.APP_URL || "").replace(/\/$/, "");
        return json({ ...row, url: `${appUrl}/api/public/media/${row.id}` }, 201);
      },
    },
  },
});
