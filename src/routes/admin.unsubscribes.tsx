import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/unsubscribes")({
  component: UnsubsPage,
});

type Item = { id: string; email: string; unsubscribed_at: string | null; last_campaign: string | null };

function UnsubsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const r = await api<{ items: Item[] }>("/api/deliverability/unsubscribes");
      setItems(r.items);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Unsubscribes"
        description="Contacts who have opted out of email."
        actions={<Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Last Campaign</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No unsubscribes yet</TableCell></TableRow>
              ) : items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.last_campaign || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.unsubscribed_at ? new Date(u.unsubscribed_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
