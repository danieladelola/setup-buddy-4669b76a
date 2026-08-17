import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import {
  getCampaignPerformance, getOverview, getTopLinks,
  type CampaignPerformance, type AnalyticsOverview, type TopLink,
} from "@/lib/analyticsApi";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

const fmt = new Intl.NumberFormat("en-US");
const rangeFor = (days: number) => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
};

function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [items, setItems] = useState<CampaignPerformance[]>([]);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);
  const [loading, setLoading] = useState(true);
  const range = useMemo(() => rangeFor(days), [days]);

  const load = async () => {
    setLoading(true);
    try {
      const [o, c, links] = await Promise.all([
        getOverview(range),
        getCampaignPerformance(range),
        getTopLinks(range),
      ]);
      setOverview(o);
      setItems(c);
      setTopLinks(links);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  return (
    <>
      <PageHeader
        title="Campaign Analytics"
        description="Per-campaign performance, calculated from SES + SNS events."
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
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard label="Campaigns" value={overview?.total_campaigns ?? 0} />
        <MetricCard label="Sent" value={fmt.format(overview?.sent ?? 0)} />
        <MetricCard label="Delivered" value={fmt.format(overview?.delivered ?? 0)} intent="positive" />
        <MetricCard label="Opened" value={fmt.format(overview?.unique_opens ?? 0)} />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Per-campaign performance</CardTitle>
          <CardDescription>Click a row to open the campaign detail.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Opens</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
                <TableHead className="text-right">Open %</TableHead>
                <TableHead className="text-right">Click %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No campaigns in this window."}
                  </TableCell>
                </TableRow>
              )}
              {items.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-medium">
                    <Link to="/admin/campaigns/$id" params={{ id: c.id }} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{c.status}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(c.total_recipients)}</TableCell>
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top clicked links</CardTitle>
          <CardDescription>Across all campaigns in this window.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Unique</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLinks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    No click events recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {topLinks.map((l) => (
                <TableRow key={l.url}>
                  <TableCell className="max-w-xl truncate font-mono text-xs">
                    <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                      {l.url}<ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(l.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt.format(l.unique_clicks)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
