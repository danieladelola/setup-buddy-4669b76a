import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmailBuilder } from "@/components/email-builder/EmailBuilder";
import { getTemplate, type Template } from "@/lib/templatesApi";

export const Route = createFileRoute("/admin/templates/builder/$id")({
  component: BuilderPage,
});

function BuilderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (id === "new") {
        setTemplate(null);
        setLoading(false);
        return;
      }
      try {
        const t = await getTemplate(id);
        if (cancelled) return;
        if (!t) { toast.error("Template not found"); navigate({ to: "/admin/templates" }); return; }
        setTemplate(t);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load template");
        navigate({ to: "/admin/templates" });
      } finally { setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 grid place-items-center bg-background text-sm text-muted-foreground">
        Loading builder…
      </div>
    );
  }
  return <EmailBuilder initial={template} />;
}
