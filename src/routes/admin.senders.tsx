import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, CheckCircle2, AlertCircle, Star, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/senders")({
  component: SendersPage,
});

type Sender = { identity: string; type: "email" | "domain"; status: string; isDefault: boolean };

function SendersPage() {
  const [items, setItems] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [val, setVal] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ items: Sender[]; error?: string }>("/api/deliverability/senders");
      setItems(r.items);
      if (r.error) setError(r.error);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!val) return;
    try {
      await api("/api/deliverability/senders", { method: "POST", body: { identity: val } });
      toast.success("Verification email/DNS records initiated");
      setVal("");
      load();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (id: string) => {
    try {
      await api(`/api/deliverability/senders/${encodeURIComponent(id)}`, { method: "DELETE" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Senders"
        description="Verified From addresses and domains in AWS SES."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>}
      />
      {error && <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      <Card className="mb-4">
        <CardContent className="flex gap-2 p-4">
          <Input placeholder="email@hsenations.com or hsenations.com" value={val} onChange={(e) => setVal(e.target.value)} />
          <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Verify</Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.length === 0 && !loading && (
          <div className="col-span-full text-sm text-muted-foreground">No SES identities found.</div>
        )}
        {items.map((s) => (
          <Card key={s.identity}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.identity}</div>
                  <div className="text-xs text-muted-foreground uppercase">{s.type}</div>
                </div>
                {s.isDefault && <Badge><Star className="mr-1 h-3 w-3" />Default</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                {s.status === "Success" ? (
                  <span className="flex items-center gap-1.5 text-emerald-500"><CheckCircle2 className="h-4 w-4" />Verified</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-500"><AlertCircle className="h-4 w-4" />{s.status}</span>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(s.identity)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
