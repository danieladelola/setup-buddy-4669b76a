import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, RefreshCw, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/providers")({
  component: ProvidersPage,
});

type Provider = {
  id: string;
  name: string;
  provider: string;
  region: string | null;
  from_email: string | null;
  from_name: string | null;
  configuration_set: string | null;
  sns_topic_arn: string | null;
  is_default: boolean;
  status: string;
  source: "env" | "db";
};

function ProvidersPage() {
  const [items, setItems] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Provider[] }>("/api/deliverability/providers");
      setItems(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    try {
      await api(`/api/deliverability/providers/${id}`, { method: "DELETE" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Email Providers"
        description="Sending infrastructure connected to HSENations Mail."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start gap-4 p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary-foreground">
                <Server className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="flex items-center gap-1">
                    {p.is_default && <Badge><Star className="mr-1 h-3 w-3" />Default</Badge>}
                    <Badge variant={p.status === "healthy" ? "default" : "outline"}>{p.status}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.provider.toUpperCase()} · {p.region || "no region"}
                </div>
                <div className="mt-2 space-y-0.5 text-xs">
                  <div><span className="text-muted-foreground">From:</span> {p.from_name || "—"} &lt;{p.from_email || "—"}&gt;</div>
                  <div className="truncate"><span className="text-muted-foreground">Config set:</span> {p.configuration_set || "—"}</div>
                  <div className="truncate"><span className="text-muted-foreground">SNS topic:</span> {p.sns_topic_arn || "—"}</div>
                </div>
                {p.source === "db" && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
