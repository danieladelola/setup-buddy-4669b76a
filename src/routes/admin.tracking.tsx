import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, MousePointerClick, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/admin/page-header";
import { MetricCard } from "@/components/admin/metric-card";
import {
  getTrackingEvents, getOverview, getTopLinks,
  type TrackingEvent, type AnalyticsOverview, type TopLink,
} from "@/lib/analyticsApi";

export const Route = createFileRoute("/admin/tracking")({
  component: TrackingPage,
});

const fmt = new Intl.NumberFormat("en-US");
const rangeFor = (days: number) => {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400_000);
  return { from: from.toISOString(), to: to.toISOString() };
};

function TrackingPage() {
  const [days, setDays] = useState(30);
  const [type, setType] = useState<"all" | "open" | "click">("all");
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [topLinks, setTopLinks] = useState<TopLink[]>([]);
  const [loading, setLoading] = useState(true);
  const range = useMemo(() => rangeFor(days), [days]);

  const load = async () => {
    setLoading(true);
    try {
      const [ev, ov, links] = await Promise.all([
        getTrackingEvents({ ...range, type: type === "all" ? undefined : type, limit: 300 }),
        getOverview(range),
        getTopLinks(range),
      ]);
      setEvents(ev);
      setOverview(ov);
      setTopLinks(links);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days, type]);

  return (
    <>
      <PageHeader
        title="Open & Click Tracking"
        description="Recent open and click events from the tracking pixel and link redirects."
        actions={
          <>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Opens</SelectItem>
                <SelectItem value="click">Clicks</SelectItem>
              </SelectContent>
            </Select>
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
        <MetricCard label="Opens" value={fmt.format(overview?.opened ?? 0)} icon={Eye} />
        <MetricCard label="Unique Opens" value={fmt.format(overview?.unique_opens ?? 0)} icon={Eye} />
        <MetricCard label="Clicks" value={fmt.format(overview?.clicked ?? 0)} icon={MousePointerClick} />
        <MetricCard label="Unique Clicks" value={fmt.format(overview?.unique_clicks ?? 0)} icon={MousePointerClick} />
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent tracking events</CardTitle>
          <CardDescription>Latest 300 open & click events.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>User-Agent</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    {loading ? "Loading…" : "No open or click events recorded yet."}
                  </TableCell>
                </TableRow>
              )}
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {e.event_type === "open"
                        ? <Eye className="mr-1 h-3 w-3" />
                        : <MousePointerClick className="mr-1 h-3 w-3" />}
                      {e.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{e.recipient_email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{e.campaign_name || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">
                    {e.link_url ? (
                      <a href={e.link_url} target="_blank" rel="noreferrer" className="hover:underline">{e.link_url}</a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{e.user_agent || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{e.ip_address || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Top clicked links</CardTitle></CardHeader>
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
                  <TableCell className="max-w-xl truncate font-mono text-xs">{l.url}</TableCell>
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
