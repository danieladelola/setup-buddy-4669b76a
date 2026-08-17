// Admin remove suppression by email (path-encoded).
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/deliverability/suppression/$email")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { removeSuppression } = await import("@/lib/suppression.server");
        const removed = await removeSuppression(decodeURIComponent(params.email));
        return json({ ok: true, removed });
      },
    },
  },
});
