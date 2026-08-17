import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ListChecks,
  Send,
  Mail,
  CheckCircle2,
  MousePointerClick,
  AlertTriangle,
  ShieldAlert,
  UserMinus,
  XCircle,
  Inbox,
  Eye,
  Plus,
  Upload,
  FileText,
  AtSign,
  BarChart3,
  Activity,
  Ban,
  Truck,
  PauseCircle,
  Calendar,
  FilePen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { getDashboardSummary } from "@/lib/dashboardApi";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const fmt = new Intl.NumberFormat("en-US");

function fmtTime(s: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Loading live data…" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Dashboard" description="Could not load dashboard." />
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {(error as Error)?.message || "Unknown error"}
          </CardContent>
        </Card>
      </>
    );
  }

  const m = data.metrics;
  const maxSent = Math.max(1, ...data.sending_activity.map((d) => d.sent));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of your email program — deliverability, engagement, and sending health."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/reports">
                <BarChart3 className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/admin/campaigns/builder">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Link>
            </Button>
          </>
        }
      />

      {/* Core counts */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Total Contacts" value={fmt.format(m.total_contacts)} icon={Users} />
        <MetricCard label="Contact Lists" value={fmt.format(m.total_lists)} icon={ListChecks} />
        <MetricCard label="Total Campaigns" value={fmt.format(m.total_campaigns)} icon={Send} />
        <MetricCard label="Suppressed Emails" value={fmt.format(m.suppressed_emails)} icon={Ban} intent="warning" />
      </section>

      {/* Campaign mix */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Draft Campaigns" value={fmt.format(m.draft_campaigns)} icon={FilePen} />
        <MetricCard label="Scheduled" value={fmt.format(m.scheduled_campaigns)} icon={Calendar} />
        <MetricCard label="Sent" value={fmt.format(m.sent_campaigns)} icon={CheckCircle2} intent="positive" />
        <MetricCard label="Emails Queued" value={fmt.format(m.emails_queued)} icon={Inbox} />
      </section>

      {/* Email throughput */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Emails Sent" value={fmt.format(m.emails_sent)} icon={Mail} />
        <MetricCard label="Delivered" value={fmt.format(m.emails_delivered)} icon={Truck} intent="positive" />
        <MetricCard label="Opened" value={fmt.format(m.emails_opened)} icon={Eye} />
        <MetricCard label="Clicked" value={fmt.format(m.emails_clicked)} icon={MousePointerClick} />
      </section>

      {/* Deliverability */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Delivery Rate" value={m.delivery_rate} suffix="%" icon={CheckCircle2} intent="positive" />
        <MetricCard label="Open Rate" value={m.open_rate} suffix="%" icon={Eye} />
        <MetricCard label="Click Rate" value={m.click_rate} suffix="%" icon={MousePointerClick} />
        <MetricCard label="Bounce Rate" value={m.bounce_rate} suffix="%" icon={AlertTriangle} intent="warning" />
      </section>

      {/* Negative signals */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Complaints" value={fmt.format(m.complaints)} icon={ShieldAlert} intent="warning" />
        <MetricCard label="Complaint Rate" value={m.complaint_rate} suffix="%" icon={ShieldAlert} intent="warning" />
        <MetricCard label="Unsubscribes" value={fmt.format(m.unsubscribes)} icon={UserMinus} />
        <MetricCard label="Failed Sends" value={fmt.format(m.failed_sends)} icon={XCircle} intent="danger" />
      </section>

      {/* Activity + Performance */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Sending Activity</CardTitle>
                <CardDescription>Last 7 days — sent, opened, clicked (from campaign_events).</CardDescription>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {data.sending_activity.length === 0 ? (
              <Empty label="No sending activity yet." />
            ) : (
              <>
                <div className="grid h-60 items-end gap-3 px-1" style={{ gridTemplateColumns: `repeat(${data.sending_activity.length}, minmax(0,1fr))` }}>
                  {data.sending_activity.map((d) => {
                    const h = Math.round((d.sent / maxSent) * 100);
                    const oh = Math.round((d.opened / maxSent) * 100);
                    const ch = Math.round((d.clicked / maxSent) * 100);
                    const label = new Date(d.day).toLocaleDateString(undefined, { weekday: "short" });
                    return (
                      <div key={d.day} className="flex flex-col items-center gap-2">
                        <div className="flex h-full w-full items-end justify-center gap-1">
                          <div className="w-2.5 rounded-t bg-primary/30" style={{ height: `${h}%` }} />
                          <div className="w-2.5 rounded-t bg-primary/60" style={{ height: `${oh}%` }} />
                          <div className="w-2.5 rounded-t bg-primary" style={{ height: `${ch}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/30" />Sent</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary/60" />Opened</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Clicked</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance Overview</CardTitle>
            <CardDescription>All-time rates from email_queue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "Delivered", value: m.delivery_rate },
              { label: "Opens", value: m.open_rate },
              { label: "Clicks", value: m.click_rate },
              { label: "Bounces", value: m.bounce_rate },
              { label: "Complaints", value: m.complaint_rate },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}%</span>
                </div>
                <Progress value={Math.min(row.value, 100)} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Recent campaigns + events */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Latest activity across your workspace.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/campaigns">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.recent_campaigns.length === 0 ? (
              <Empty label="No campaigns yet." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Recipients</TableHead>
                      <TableHead className="text-right">Opens</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recent_campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><StatusBadge status={c.status} /></TableCell>
                        <TableCell className="text-right tabular-nums">{fmt.format(c.total_recipients || c.sent)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt.format(c.opens)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt.format(c.clicks)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Live stream from campaign_events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recent_events.length === 0 ? (
              <Empty label="No events yet." />
            ) : (
              data.recent_events.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium capitalize">{e.type}</span>{" "}
                      <span className="text-muted-foreground">— {e.recipient || "unknown"}</span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.campaign || "—"} · {fmtTime(e.at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Queue + SES/SNS health */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Queue Health</CardTitle>
            <CardDescription>Current email_queue state.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-xl font-semibold tabular-nums">{fmt.format(data.queue_health.pending)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Sending</div>
              <div className="text-xl font-semibold tabular-nums">{fmt.format(data.queue_health.sending)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Sent</div>
              <div className="text-xl font-semibold tabular-nums">{fmt.format(data.queue_health.sent)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="text-xl font-semibold tabular-nums text-destructive">{fmt.format(data.queue_health.failed)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SES / SNS Health</CardTitle>
            <CardDescription>Inbound webhook activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">SNS events (total)</span><span className="font-medium tabular-nums">{fmt.format(data.sns_health?.total || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Last 24h</span><span className="font-medium tabular-nums">{fmt.format(data.sns_health?.last_24h || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Last event</span><span className="font-medium">{fmtTime(data.sns_health?.last_event_at || null)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Last type</span><span className="font-medium">{data.sns_health?.last_event_type || "—"}</span></div>
            {data.providers.length > 0 && (
              <div className="mt-3 space-y-2 border-t pt-3">
                {data.providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.provider}{p.region ? ` · ${p.region}` : ""}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Jump straight into common flows.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/campaigns/builder"><Send className="mr-2 h-4 w-4" />Create Campaign</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/import-export"><Upload className="mr-2 h-4 w-4" />Import Contacts</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/templates"><FileText className="mr-2 h-4 w-4" />Create Template</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/senders"><AtSign className="mr-2 h-4 w-4" />Add Sender</Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link to="/admin/reports"><BarChart3 className="mr-2 h-4 w-4" />View Reports</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Bounces / complaints / top */}
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Bounces</CardTitle>
                <CardDescription>Latest hard/soft bounces.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/bounces">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent_bounces.length === 0 ? (
              <Empty label="No bounces — nice!" />
            ) : (
              data.recent_bounces.map((b) => (
                <div key={b.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{b.recipient || "unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{b.campaign || "—"} · {fmtTime(b.at)}</p>
                  </div>
                  {b.type && <Badge variant="outline" className="shrink-0 capitalize">{b.type}</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Complaints</CardTitle>
                <CardDescription>Spam reports from ISPs.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/bounces">View all</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recent_complaints.length === 0 ? (
              <Empty label="No complaints." />
            ) : (
              data.recent_complaints.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.recipient || "unknown"}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.campaign || "—"} · {fmtTime(c.at)}</p>
                  </div>
                  {c.feedback_type && <Badge variant="outline" className="shrink-0 capitalize">{c.feedback_type}</Badge>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performing Campaigns</CardTitle>
            <CardDescription>Ranked by open rate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.top_campaigns.length === 0 ? (
              <Empty label="No sent campaigns yet." />
            ) : (
              data.top_campaigns.map((c) => (
                <Link
                  key={c.id}
                  to="/admin/campaigns/$id"
                  params={{ id: c.id }}
                  className="block rounded-lg border p-3 transition hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmt.format(c.sent)} sent</span>
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                    <span>Open <span className="font-medium text-foreground">{c.open_rate}%</span></span>
                    <span>Click <span className="font-medium text-foreground">{c.click_rate}%</span></span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
