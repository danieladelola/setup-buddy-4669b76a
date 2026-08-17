import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Send, Eye, MousePointerClick, AlertTriangle, UserMinus, RefreshCw,
  Mail, CheckCircle2, ShieldAlert, Clock, CloudCog, Radio, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { api } from "@/lib/api";
import {
  getCampaign, getCampaignReport, sendCampaign,
  type Campaign, type CampaignReport,
} from "@/lib/campaignsApi";

export const Route = createFileRoute("/admin/campaigns/$id")({
  component: CampaignDetail,
});

const fmt = new Intl.NumberFormat("en-US");

type SesInfo = {
  region?: string | null; configurationSet?: string | null;
  snsTopicArn?: string | null; snsWebhookUrl?: string | null;
  defaultFromEmail?: string | null;
};

function CampaignDetail() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Campaign | null>(null);
  const [r, setR] = useState<CampaignReport | null>(null);
  const [ses, setSes] = useState<SesInfo>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [campaign, report, sesInfo] = await Promise.all([
        getCampaign(id),
        getCampaignReport(id),
        api<SesInfo>(`/api/settings/ses`).catch(() => ({} as SesInfo)),
      ]);
      setC(campaign);
      setR(report);
      setSes(sesInfo);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [id]);

  const onSend = async () => {
    setSending(true);
    try {
      const res = await sendCampaign(id);
      toast.success(`Queued ${fmt.format(res.queued)} recipients into SES`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const timeline = useMemo(() => {
    if (!c) return [];
    const items: { label: string; ts?: string | null; icon: typeof Mail; tone?: string }[] = [
      { label: "Created", ts: c.created_at, icon: Mail },
      { label: "Updated", ts: c.updated_at, icon: RefreshCw },
    ];
    if (c.scheduled_at) items.push({ label: "Scheduled", ts: c.scheduled_at, icon: Clock });
    if (c.started_at) items.push({ label: "Sending started", ts: c.started_at, icon: Send, tone: "text-primary" });
    if (c.finished_at) items.push({ label: "Sending completed", ts: c.finished_at, icon: CheckCircle2, tone: "text-emerald-500" });
    return items.filter((i) => i.ts);
  }, [c]);

  if (loading && !c) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!c) return <div className="py-16 text-center text-sm text-muted-foreground">Campaign not found.</div>;

  const sentDate = c.started_at || c.finished_at || c.created_at;
  const progress = c.total_recipients > 0 && r ? Math.min(100, (r.sent / c.total_recipients) * 100) : 0;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link to="/admin/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Back to campaigns</Link>
      </Button>
      <PageHeader
        title={c.name}
        description={`${c.subject} · ${c.from_name} <${c.from_email}>`}
        actions={
          <>
            <StatusBadge status={c.status} />
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            {(c.status === "draft" || c.status === "scheduled") && (
              <Button size="sm" onClick={onSend} disabled={sending}>
                <Send className="mr-2 h-4 w-4" />{sending ? "Sending…" : "Send via SES"}
              </Button>
            )}
          </>
        }
      />

      {/* Send progress strip */}
      {["queued", "sending"].includes(c.status) && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium">SES delivery in progress</span>
                <span className="tabular-nums">{fmt.format(r?.sent ?? 0)} / {fmt.format(c.total_recipients)}</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Recipients" value={fmt.format(c.total_recipients)} icon={Mail} />
        <MetricCard label="Delivered" value={fmt.format(r?.delivered ?? 0)} suffix={r ? ` · ${r.delivery_rate}%` : ""} icon={CheckCircle2} intent="positive" />
        <MetricCard label="Opens" value={fmt.format(r?.opened ?? 0)} suffix={r ? ` · ${r.open_rate}%` : ""} icon={Eye} intent="positive" />
        <MetricCard label="Clicks" value={fmt.format(r?.clicked ?? 0)} suffix={r ? ` · ${r.click_rate}%` : ""} icon={MousePointerClick} />
        <MetricCard label="Bounces" value={fmt.format(r?.bounced ?? 0)} suffix={r ? ` · ${r.bounce_rate}%` : ""} icon={AlertTriangle} intent="warning" />
        <MetricCard label="Complaints" value={fmt.format(r?.complained ?? 0)} suffix={r ? ` · ${r.complaint_rate}%` : ""} icon={ShieldAlert} intent="warning" />
        <MetricCard label="Unsubscribes" value={fmt.format(r?.unsubscribed ?? 0)} icon={UserMinus} />
        <MetricCard label="Failed" value={fmt.format(r?.failed ?? 0)} icon={XCircle} intent="warning" />
      </div>

      <Tabs defaultValue="performance" className="mt-6">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="ses">AWS SES / SNS</TabsTrigger>
          <TabsTrigger value="timeline">Activity</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Engagement breakdown</CardTitle>
                <CardDescription>Rates calculated from SES + SNS events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { l: "Delivered", v: r?.delivery_rate ?? 0, tone: "bg-emerald-500" },
                  { l: "Opened", v: r?.open_rate ?? 0, tone: "bg-primary" },
                  { l: "Clicked", v: r?.click_rate ?? 0, tone: "bg-violet-500" },
                  { l: "Bounced", v: r?.bounce_rate ?? 0, tone: "bg-amber-500" },
                  { l: "Complained", v: r?.complaint_rate ?? 0, tone: "bg-destructive" },
                ].map((row) => (
                  <div key={row.l}>
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">{row.l}</span>
                      <span className="font-medium tabular-nums">{row.v}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className={`h-full ${row.tone}`} style={{ width: `${Math.min(100, row.v)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Funnel</CardTitle>
                <CardDescription>From queue to click in absolute numbers.</CardDescription>
              </CardHeader>
              <CardContent>
                <Funnel
                  steps={[
                    { label: "Recipients", value: c.total_recipients, tone: "bg-muted-foreground/30" },
                    { label: "Sent", value: r?.sent ?? 0, tone: "bg-primary/60" },
                    { label: "Delivered", value: r?.delivered ?? 0, tone: "bg-emerald-500/70" },
                    { label: "Opened", value: r?.opened ?? 0, tone: "bg-violet-500/70" },
                    { label: "Clicked", value: r?.clicked ?? 0, tone: "bg-fuchsia-500/70" },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ses" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CloudCog className="h-4 w-4" />AWS SES</CardTitle>
                <CardDescription>Where this campaign is dispatched from.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <KV label="Region" value={ses.region} mono />
                <KV label="Configuration set" value={ses.configurationSet} mono />
                <KV label="Sending identity" value={c.from_email} mono />
                <KV label="From name" value={c.from_name} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4" />AWS SNS</CardTitle>
                <CardDescription>Event topic and webhook handling SES events.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <KV label="Topic ARN" value={ses.snsTopicArn} mono />
                <KV label="Webhook" value={ses.snsWebhookUrl} mono />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Delivery", "Bounce", "Complaint", "Open", "Click", "Reject", "DeliveryDelay"].map((e) => (
                    <Badge key={e} variant="secondary" className="font-mono text-[11px]">{e}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Lifecycle milestones for this campaign.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-5">
                {timeline.map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[26px] grid h-5 w-5 place-items-center rounded-full border bg-background ${it.tone || ""}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="text-sm font-medium">{it.label}</div>
                      <div className="text-xs text-muted-foreground">{new Date(it.ts!).toLocaleString()}</div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent content</CardTitle>
              <CardDescription>Snapshot of the HTML that went out.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border bg-white">
                <iframe title="content" srcDoc={c.html_body} className="h-[600px] w-full border-0" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function KV({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-right text-sm ${mono ? "font-mono text-xs" : ""} ${!value ? "italic text-muted-foreground" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; value: number; tone: string }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{fmt.format(s.value)}</span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-md bg-muted/40">
              <div className={`h-full ${s.tone} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
