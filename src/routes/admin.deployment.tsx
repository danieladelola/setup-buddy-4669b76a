import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/deployment")({
  component: DeploymentPage,
});

type Readiness = {
  env: { name: string; present: boolean }[];
  missing: string[];
  ready: boolean;
  app_url: string | null;
  scheduler_command: string | null;
  sns_webhook_url: string | null;
};

function copy(s: string) {
  navigator.clipboard.writeText(s).then(() => toast.success("Copied"));
}

function DeploymentPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await api<Readiness>("/api/system/deployment")); }
    catch (e: any) { toast.error("Load failed", { description: e?.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader
        title="Deployment Readiness"
        description="Required environment, scheduler setup, and SNS webhook configuration."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Recheck
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Required environment variables</CardTitle>
          <CardDescription>
            Only the presence of each value is reported — actual secrets are never returned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data && <div className="text-muted-foreground">Loading…</div>}
          {data && (
            <>
              <div className={data.ready ? "mb-4 text-sm text-emerald-600" : "mb-4 text-sm text-destructive"}>
                {data.ready
                  ? "All required environment variables are set."
                  : `${data.missing.length} missing: ${data.missing.join(", ")}`}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.env.map((e) => (
                  <li key={e.name} className="flex items-center gap-2 text-sm">
                    {e.present
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      : <XCircle className="h-4 w-4 text-destructive" />}
                    <code className="font-mono">{e.name}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coolify scheduler (every 60 seconds)</CardTitle>
          <CardDescription>
            Add this as a scheduled task. The endpoint is idempotent and uses{" "}
            <code>FOR UPDATE SKIP LOCKED</code> so concurrent runs are safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted p-3 font-mono text-xs">
            {data?.scheduler_command || "Set APP_URL to display the command."}
          </div>
          {data?.scheduler_command && (
            <Button size="sm" variant="outline" onClick={() => copy(data.scheduler_command!)}>
              <Copy className="mr-2 h-4 w-4" /> Copy command
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Cron expression: <code>* * * * *</code> (every minute). Increase <code>batch=</code> for higher
            throughput, up to 100 per call.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>SNS webhook URL</CardTitle>
          <CardDescription>
            Configure as the HTTPS subscription endpoint for the SES SNS topic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">
            {data?.sns_webhook_url || "Set APP_URL to display the URL."}
          </div>
          {data?.sns_webhook_url && (
            <Button size="sm" variant="outline" onClick={() => copy(data.sns_webhook_url!)}>
              <Copy className="mr-2 h-4 w-4" /> Copy URL
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Signatures from <code>sns.&lt;region&gt;.amazonaws.com</code> are verified on every request.
            The <code>?secret=</code> query is a belt-and-suspenders gate.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
