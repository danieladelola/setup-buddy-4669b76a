// Audit log helper. Writes are best-effort: never break a request because
// audit logging failed. The audit_log table is created in migrations.sql.
import { db } from "@/lib/db.server";
import { clientIp } from "@/lib/rate-limit.server";

export interface AuditActor {
  id?: string | null;
  email?: string | null;
}

export interface AuditEntry {
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
}

export async function audit(
  actor: AuditActor | null,
  entry: AuditEntry,
  request?: Request,
): Promise<void> {
  try {
    const sql = db();
    const ip = request ? clientIp(request) : null;
    await sql`
      INSERT INTO audit_log (actor_id, actor_email, action, entity_type, entity_id, metadata, ip)
      VALUES (
        ${actor?.id ?? null},
        ${actor?.email ?? null},
        ${entry.action},
        ${entry.entity_type ?? null},
        ${entry.entity_id ?? null},
        ${sql.json((entry.metadata ?? {}) as any)},
        ${ip}
      )`;
  } catch (err) {
    console.error("[audit] failed to write entry", entry.action, err);
  }
}
