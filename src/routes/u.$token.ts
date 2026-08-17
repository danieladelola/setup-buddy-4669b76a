// Legacy alias for /api/unsubscribe/$token — preserves links in already-sent emails.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { gatePublic } = await import("@/lib/public-gate.server");
        const blocked = gatePublic(request, "unsubscribe.get");
        if (blocked) return blocked;
        const { handleUnsubscribeGet } = await import("@/lib/tracking-handlers.server");
        return handleUnsubscribeGet(params.token, `/u/${params.token}`);
      },
      POST: async ({ request, params }) => {
        const { gatePublic } = await import("@/lib/public-gate.server");
        const blocked = gatePublic(request, "unsubscribe.post");
        if (blocked) return blocked;
        const { handleUnsubscribePost } = await import("@/lib/tracking-handlers.server");
        return handleUnsubscribePost(params.token);
      },
    },
  },
});
