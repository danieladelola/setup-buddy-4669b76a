// Legacy alias for /api/track/click/$token — preserves links in already-sent emails.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/t/c/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { gatePublic } = await import("@/lib/public-gate.server");
        const blocked = gatePublic(request, "track.click");
        if (blocked) return blocked;
        const { handleClickTracking } = await import("@/lib/tracking-handlers.server");
        return handleClickTracking(params.token);
      },
    },
  },
});
