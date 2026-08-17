// Returns real audience counts for the builder review screen. Counts come
// from the same computeAudience() the send path uses, so the preview can't
// drift from what actually gets queued.
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth, json } from "@/lib/server-auth";

export const Route = createFileRoute("/api/campaigns/preview-audience")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request);
        if (auth instanceof Response) return auth;
        const body = await request.json().catch(() => ({}));
        const listIds: string[] = Array.isArray(body?.list_ids)
          ? body.list_ids.filter((x: unknown) => typeof x === "string")
          : [];
        const excludeListIds: string[] = Array.isArray(body?.exclude_list_ids)
          ? body.exclude_list_ids.filter((x: unknown) => typeof x === "string")
          : [];
        const { computeAudience } = await import("@/lib/audience.server");
        const { counts } = await computeAudience({ listIds, excludeListIds });
        return json({ counts });
      },
    },
  },
});
