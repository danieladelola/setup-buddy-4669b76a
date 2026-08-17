import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, ShieldOff, FileJson } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/page-header";
import {
  getBounceEvents, getComplaintEvents, getEventRaw, downloadCsv, addSuppression,
  type BounceEvent, type ComplaintEvent,
} from "@/lib/analyticsApi";

export const Route = createFileRoute("/admin/bounces")({
  component: BouncesPage,
});

const rangeFor = (days: number) => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
};

function BouncesPage() {
  const [days, setDays] = useState(30);
  const [bounces, setBounces] = useState<BounceEvent[]>([]);
  const [complaints, setComplaints] = useState<ComplaintEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<any | null>(null);
  const range = useMemo(() => rangeFor(days), [days]);

  const load = async () => {
    setLoading(true);
    try {
      const [b, c] = await Promise.all([getBounceEvents(range), getComplaintEvents(range)]);
      setBounces(b);
      setComplaints(c);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const onSuppress = async (email: string | null, reason: string) => {
    if (!email) return;
    try {
      await addSuppression(email, reason);
      toast.success(`${email} added to suppression list`);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const viewRaw = async (id: number) => {
    try {
      const r = await getEventRaw(id);
      setRaw(r);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Bounce & Complaint Logs"
        description="Deliverability events received from AWS SES via SNS."
        actions={
          <>
            <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v, 10))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("bounces", range)}>
              <Download className="mr-2 h-4 w-4" />Bounces CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv("complaints", range)}>
              <Download className="mr-2 h-4 w-4" />Complaints CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bounces ({bounces.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subtype</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bounces.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No bounce events recorded yet."}
                    </TableCell>
                  </TableRow>
                )}
                {bounces.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.recipient_email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={b.bounce_type === "Permanent"
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-amber-500/15 text-amber-500 border-amber-500/30"}>
                        {b.bounce_type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.bounce_subtype || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{b.campaign_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(b.occurred_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => viewRaw(b.id)} title="View raw">
                        <FileJson className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onSuppress(b.recipient_email, "bounce")} title="Suppress">
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Complaints ({complaints.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No complaint events recorded yet."}
                    </TableCell>
                  </TableRow>
                )}
                {complaints.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.recipient_email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.feedback_type || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.campaign_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(c.occurred_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => viewRaw(c.id)} title="View raw">
                        <FileJson className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onSuppress(c.recipient_email, "complaint")} title="Suppress">
                        <ShieldOff className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!raw} onOpenChange={(o) => !o && setRaw(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Raw event payload</DialogTitle></DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs">
            {raw ? JSON.stringify(raw, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
}
