import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import {
  getOverview, getTrends, getCampaignPerformance, downloadCsv,
  type AnalyticsOverview, type TrendPoint, type CampaignPerformance,
} from "@/lib/analyticsApi";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const fmt = new Intl.NumberFormat("en-US");

function rangeFor(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function TrendChart({ title, points, accessor, color }: {
  title: string;
  points: TrendPoint[];
  accessor: (p: TrendPoint) => number;
  color: string;
}) {
  const max = Math.max(1, ...points.map(accessor));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
            No events yet
          </div>
        ) : (
          <div className="flex h-40 items-end gap-1">
            {points.map((p) => {
              const v = accessor(p);
              const h = Math.max(2, Math.round((v / max) * 100));
              return (
                <div
                  key={p.bucket}
                  title={`${new Date(p.bucket).toLocaleDateString()} · ${v}`}
                  className={`flex-1 rounded-t ${color}`}
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => rangeFor(days), [days]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, t, c] = await Promise.all([
        getOverview(range),
        getTrends({ ...range, interval: "day" }),
        getCampaignPerformance(range),
      ]);
      setOverview(o);
      setTrends(t.points);
      setCampaigns(c);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const onExport = async () => {
    try {
      await downloadCsv("campaigns", range);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Performance across campaigns from real SES + SNS events."
        actions={
          <>
            <Select value={String(days)} onValueChange={(v) => setDays(parseInt(v, 10))}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />Export CSV
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Total Sent" value={fmt.format(overview?.sent ?? 0)} icon={BarChart3} />
        <MetricCard label="Delivered" value={fmt.format(overview?.delivered ?? 0)} suffix={overview ? `· ${overview.delivery_rate}%` : ""} intent="positive" />
        <MetricCard label="Open Rate" value={overview?.open_rate ?? 0} suffix="%" />
        <MetricCard label="Click Rate" value={overview?.click_rate ?? 0} suffix="%" />
        <MetricCard label="Bounce Rate" value={overview?.bounce_rate ?? 0} suffix="%" intent="warning" />
        <MetricCard label="Complaint Rate" value={overview?.complaint_rate ?? 0} suffix="%" intent="warning" />
        <MetricCard label="Unsubscribes" value={fmt.format(overview?.unsubscribed ?? 0)} />
        <MetricCard label="Failed" value={fmt.format(overview?.failed ?? 0)} intent="danger" />
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TrendChart title="Sends" points={trends} accessor={(p) => p.sent} color="bg-primary" />
        <TrendChart title="Opens" points={trends} accessor={(p) => p.opened} color="bg-emerald-500" />
        <TrendChart title="Clicks" points={trends} accessor={(p) => p.clicked} color="bg-violet-500" />
        <TrendChart title="Bounces" points={trends} accessor={(p) => p.bounced} color="bg-amber-500" />
        <TrendChart title="Complaints" points={trends} accessor={(p) => p.complained} color="bg-destructive" />
        <TrendChart title="Unsubscribes" points={trends} accessor={(p) => p.unsubscribed} color="bg-muted-foreground" />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Campaign performance</CardTitle>
          <CardDescription>One row per campaign in the selected window.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Unique Opens</TableHead>
                <TableHead className="text-right">Unique Clicks</TableHead>
                <TableHead className="text-right">Bounced</TableHead>
                <TableHead className="text-right">Open %</TableHead>
                <TableHead className="text-right">Click %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No campaigns in this period."}
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.sent)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.delivered)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.unique_opens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.unique_clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.bounced)}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.open_rate}%</TableCell>
                  <TableCell className="text-right tabular-nums">{c.click_rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
