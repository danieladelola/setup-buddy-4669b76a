import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, MoreHorizontal, Eye, Trash2, Send, RefreshCw,
  Mail, CheckCircle2, AlertTriangle, CloudCog, Radio, Activity,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { api } from "@/lib/api";
import {
  listCampaigns, deleteCampaign, sendCampaign, getCampaignReport,
  type CampaignRow, type CampaignStatus, type CampaignReport,
} from "@/lib/campaignsApi";

export const Route = createFileRoute("/admin/campaigns/")({
  component: CampaignsPage,
});

const fmt = new Intl.NumberFormat("en-US");

type StatusFilter = "all" | CampaignStatus;
const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "queued", label: "Queued" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Paused" },
];

type SesInfo = {
  region?: string | null;
  configurationSet?: string | null;
  snsTopicArn?: string | null;
  snsWebhookUrl?: string | null;
  healthy?: boolean;
  missing?: string[];
  lastSnsEvent?: { received_at: string; event_type: string; message_id: string } | null;
};

function CampaignsPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [reports, setReports] = useState<Record<string, CampaignReport>>({});
  const [ses, setSes] = useState<SesInfo>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [deleting, setDeleting] = useState<CampaignRow | null>(null);
  const [sending, setSending] = useState<CampaignRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [data, sesInfo] = await Promise.all([
        listCampaigns(),
        api<SesInfo>(`/api/settings/ses`).catch(() => ({} as SesInfo)),
      ]);
      setRows(data);
      setSes(sesInfo);
      // fetch reports in parallel for non-draft rows (best-effort)
      const reportable = data.filter((c) => c.status !== "draft");
      const results = await Promise.all(
        reportable.map((c) =>
          getCampaignReport(c.id).then((r) => [c.id, r] as const).catch(() => null),
        ),
      );
      const map: Record<string, CampaignReport> = {};
      results.forEach((r) => { if (r) map[r[0]] = r[1]; });
      setReports(map);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(
    () => rows.filter(
      (c) => (status === "all" || c.status === status)
        && c.name.toLowerCase().includes(q.toLowerCase()),
    ),
    [rows, status, q],
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    rows.forEach((r) => { m[r.status] = (m[r.status] ?? 0) + 1; });
    return m;
  }, [rows]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCampaign(deleting.id);
      toast.success("Campaign deleted");
      setDeleting(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const confirmSend = async () => {
    if (!sending) return;
    try {
      const r = await sendCampaign(sending.id);
      toast.success(`Queued ${fmt.format(r.queued)} recipients into SES`);
      setSending(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Plan, send, and monitor every email campaign through AWS SES and SNS."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button asChild>
              <Link to="/admin/campaigns/builder"><Plus className="mr-2 h-4 w-4" />New Campaign</Link>
            </Button>
          </>
        }
      />

      {/* SES / SNS health widgets */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          icon={CloudCog}
          label="SES"
          value={ses.region || "Not configured"}
          ok={!!ses.region && (ses.missing?.length ?? 0) === 0}
          hint={ses.configurationSet ? `Config: ${ses.configurationSet}` : "No config set"}
        />
        <HealthCard
          icon={Radio}
          label="SNS"
          value={ses.snsTopicArn ? "Connected" : "Not configured"}
          ok={!!ses.snsTopicArn}
          hint={ses.snsWebhookUrl || "—"}
        />
        <HealthCard
          icon={Activity}
          label="Last SNS event"
          value={ses.lastSnsEvent?.event_type || "No events yet"}
          ok={!!ses.lastSnsEvent}
          hint={ses.lastSnsEvent ? new Date(ses.lastSnsEvent.received_at).toLocaleString() : "—"}
        />
        <HealthCard
          icon={Mail}
          label="Active sends"
          value={String((counts.sending ?? 0) + (counts.queued ?? 0))}
          ok={true}
          hint={`${counts.sent ?? 0} sent · ${counts.failed ?? 0} failed`}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search campaigns…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <TabsList className="flex-wrap">
                {STATUSES.map((s) => (
                  <TabsTrigger key={s.value} value={s.value} className="capitalize">
                    {s.label}
                    {counts[s.value] ? <span className="ml-1.5 text-[10px] text-muted-foreground">{counts[s.value]}</span> : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Bounces</TableHead>
                  <TableHead className="text-right">Complaints</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const r = reports[c.id];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-[260px]">
                        <Link to="/admin/campaigns/$id" params={{ id: c.id }} className="block min-w-0 hover:underline">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{c.from_name} &lt;{c.from_email}&gt;</div>
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{fmt.format(c.total_recipients)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? fmt.format(r.delivered) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? `${r.open_rate}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? `${r.click_rate}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? fmt.format(r.bounced) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{r ? fmt.format(r.complained) : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/admin/campaigns/$id" params={{ id: c.id }}>
                                <Eye className="mr-2 h-4 w-4" />View details
                              </Link>
                            </DropdownMenuItem>
                            {(c.status === "draft" || c.status === "scheduled") && (
                              <DropdownMenuItem onClick={() => setSending(c)}>
                                <Send className="mr-2 h-4 w-4" />Send now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={!["draft", "scheduled", "cancelled"].includes(c.status)}
                              onClick={() => setDeleting(c)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                      {rows.length === 0 ? "No campaigns yet. Click New Campaign to create one." : "No campaigns match your filters."}
                    </TableCell>
                  </TableRow>
                )}
                {loading && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently removed. Only draft, scheduled or cancelled campaigns can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!sending} onOpenChange={(o) => !o && setSending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send "{sending?.name}" now?</AlertDialogTitle>
            <AlertDialogDescription>
              All eligible recipients on the campaign's list will be queued and dispatched via AWS SES.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>Send via SES</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HealthCard({ icon: Icon, label, value, hint, ok }: {
  icon: typeof CloudCog; label: string; value: string; hint?: string; ok: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {ok ? (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="mr-1 h-3 w-3" />OK
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-500">
              <AlertTriangle className="mr-1 h-3 w-3" />Check
            </Badge>
          )}
        </div>
        <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-base font-semibold">{value}</div>
        {hint && <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
