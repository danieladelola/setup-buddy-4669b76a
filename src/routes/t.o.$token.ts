// Legacy alias for /api/track/open/$token — preserves links in already-sent emails.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/t/o/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { gatePublic } = await import("@/lib/public-gate.server");
        const blocked = gatePublic(request, "track.open");
        if (blocked) return blocked;
        const { handleOpenTracking } = await import("@/lib/tracking-handlers.server");
        return handleOpenTracking(params.token);
      },
    },
  },
});
