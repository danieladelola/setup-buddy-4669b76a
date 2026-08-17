import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

// Read-only Brevo configuration status. The API key itself is never returned —
// only a masked fingerprint so the admin can confirm which key is loaded.
export const Route = createFileRoute("/api/settings/brevo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const { getBrevoConfig } = await import("@/lib/brevo.server");
        return json(getBrevoConfig());
      },
    },
  },
});
