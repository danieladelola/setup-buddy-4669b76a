import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/suppression")({
  component: SuppressionPage,
});

type Item = { email: string; reason: string; created_at: string };

function SuppressionPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await api<{ items: Item[] }>("/api/deliverability/suppression");
      setItems(items);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newEmail) return;
    try {
      await api("/api/deliverability/suppression", { method: "POST", body: { email: newEmail, reason: "manual" } });
      setNewEmail("");
      toast.success("Added");
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (email: string) => {
    try {
      await api(`/api/deliverability/suppression/${encodeURIComponent(email)}`, { method: "DELETE" });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        title="Suppression List"
        description="Addresses excluded from all sending — bounces, complaints, manual blocks."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex gap-2 p-4">
          <Input placeholder="email@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button onClick={add}><Plus className="mr-2 h-4 w-4" />Suppress</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">No suppressed addresses</TableCell></TableRow>
              ) : items.map((s) => (
                <TableRow key={s.email}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell><Badge variant="outline">{s.reason}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(s.email)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
