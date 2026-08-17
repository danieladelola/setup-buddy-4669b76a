import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, RefreshCw, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/sns")({
  component: SnsPage,
});

type Cfg = {
  snsWebhookUrl: string | null;
  snsTopicArn: string | null;
  hasSnsWebhookSecret: boolean;
  configurationSet: string | null;
  region: string | null;
};

type Event = {
  id: number;
  message_id: string | null;
  event_type: string | null;
  received_at: string;
  topic_arn: string | null;
  subject: string | null;
};

function SnsPage() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        api<Cfg>("/api/settings/ses"),
        api<{ events: Event[] }>("/api/settings/sns/events"),
      ]);
      setCfg(c);
      setEvents(e.events);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  return (
    <>
      <PageHeader
        title="SNS Webhooks"
        description="Amazon SNS endpoint receiving SES delivery events."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" /> Webhook Endpoint
            </CardTitle>
            <CardDescription>
              Set this as the HTTPS subscription target on your SNS topic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border bg-muted/30 px-3 py-2 text-sm break-all">
                {cfg?.snsWebhookUrl || "—"}
              </code>
              {cfg?.snsWebhookUrl && (
                <Button size="icon" variant="outline" onClick={() => copy(cfg.snsWebhookUrl!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <div>Region: <span className="font-mono">{cfg?.region || "—"}</span></div>
              <div>Configuration Set: <span className="font-mono">{cfg?.configurationSet || "—"}</span></div>
              <div className="sm:col-span-2 break-all">Topic ARN: <span className="font-mono">{cfg?.snsTopicArn || "—"}</span></div>
              <div>Webhook secret: {cfg?.hasSnsWebhookSecret ? "configured" : "not set"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent SNS Events</CardTitle>
            <CardDescription>Last 10 raw messages received from SNS.</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No SNS events received yet.
              </div>
            ) : (
              <div className="divide-y">
                {events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{e.event_type || "Unknown"}</div>
                      <div className="truncate text-xs text-muted-foreground font-mono">
                        {e.message_id || "—"}
                      </div>
                    </div>
                    <Badge variant="outline">{new Date(e.received_at).toLocaleString()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
