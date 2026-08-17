import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Filter, Play, RotateCw, X, Search, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { Inbox, Send, CheckCircle2, XCircle, Ban } from "lucide-react";
import { queueApi, type QueueRow, type QueueListResponse } from "@/lib/queueApi";

export const Route = createFileRoute("/admin/queue")({
  component: QueuePage,
});

const fmt = new Intl.NumberFormat("en-US");
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString() : "—";

function QueuePage() {
  const [data, setData] = useState<QueueListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<QueueRow | null>(null);
  const [detailEvents, setDetailEvents] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queueApi.list({
        status: status === "all" ? undefined : status,
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 200,
      });
      setData(res);
      setSelected(new Set());
    } catch (e: any) {
      setError(e?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [status]);

  const rows = data?.rows ?? [];
  const metrics = data?.metrics ?? { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0, cancelled: 0 };

  const selectedFailed = useMemo(
    () => rows.filter((r) => selected.has(r.id) && r.status === "failed").map((r) => r.id),
    [rows, selected],
  );
  const selectedPending = useMemo(
    () => rows.filter((r) => selected.has(r.id) && r.status === "pending").map((r) => r.id),
    [rows, selected],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handle = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const res: any = await fn();
      toast.success(`${label} ✓`, { description: JSON.stringify(res) });
      await load();
    } catch (e: any) {
      toast.error(`${label} failed`, { description: e?.message || "Error" });
    } finally {
      setBusy(false);
    }
  };

  const openDetails = async (row: QueueRow) => {
    setDetailRow(row);
    setDetailEvents([]);
    try {
      const res = await queueApi.get(row.id);
      setDetailEvents(res.events || []);
    } catch (e: any) {
      toast.error("Failed to load row details");
    }
  };

  return (
    <>
      <PageHeader
        title="Email Queue"
        description="Live view of email_queue. Worker processes pending rows in batches."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" disabled={busy}
              onClick={() => handle("Process now", () => queueApi.process(50))}>
              <Play className="mr-2 h-4 w-4" /> Process Now
            </Button>
            <Button variant="outline" size="sm" disabled={busy || metrics.failed === 0}
              onClick={() => handle("Retry all failed", () => queueApi.retryFailed())}>
              <RotateCw className="mr-2 h-4 w-4" /> Retry All Failed ({metrics.failed})
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <MetricCard label="Pending"   value={fmt.format(metrics.pending)}   icon={Inbox} />
        <MetricCard label="Sending"   value={fmt.format(metrics.sending)}   icon={Send} intent="warning" />
        <MetricCard label="Sent"      value={fmt.format(metrics.sent)}      icon={CheckCircle2} intent="positive" />
        <MetricCard label="Failed"    value={fmt.format(metrics.failed)}    icon={XCircle} intent="danger" />
        <MetricCard label="Skipped"   value={fmt.format(metrics.skipped + metrics.cancelled)} icon={Ban} />
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Last processed: {fmtDate(data?.last_processed_at ?? null)}
      </div>

      <Card className="mt-6">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sending">Sending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Recipient email…" className="w-64 pl-8"
              />
            </div>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="w-52" />
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="w-52" />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>Apply</Button>

            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm"
                disabled={busy || selectedFailed.length === 0}
                onClick={() => handle("Retry selected", () => queueApi.retrySelected(selectedFailed))}>
                <RotateCw className="mr-2 h-4 w-4" /> Retry Selected ({selectedFailed.length})
              </Button>
              <Button variant="outline" size="sm"
                disabled={busy || selectedPending.length === 0}
                onClick={() => handle("Cancel selected", () => queueApi.cancelSelected(selectedPending))}>
                <X className="mr-2 h-4 w-4" /> Cancel Selected ({selectedPending.length})
              </Button>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Last error</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Queue is empty.</TableCell></TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{r.recipient_email}</TableCell>
                    <TableCell className="text-muted-foreground">{r.campaign_name || "—"}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{r.attempts}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground" title={r.last_error || ""}>
                      {r.last_error || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(r.updated_at)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDetails(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data && (
            <div className="text-xs text-muted-foreground">
              Showing {rows.length} of {fmt.format(data.total)} rows
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Queue row</DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-2 text-sm">
              <div><b>Recipient:</b> {detailRow.recipient_email}</div>
              <div><b>Campaign:</b> {detailRow.campaign_name} ({detailRow.campaign_id})</div>
              <div><b>Status:</b> {detailRow.status}</div>
              <div><b>Attempts:</b> {detailRow.attempts}</div>
              <div><b>SES MessageId:</b> {detailRow.ses_message_id || "—"}</div>
              <div><b>Last error:</b> {detailRow.last_error || "—"}</div>
              <div><b>Created:</b> {fmtDate(detailRow.created_at)}</div>
              <div><b>Sent:</b> {fmtDate(detailRow.sent_at)}</div>
              <div>
                <b>Events ({detailEvents.length}):</b>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(detailEvents, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
