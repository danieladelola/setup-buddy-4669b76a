import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ses")({
  component: SesPage,
});

type SesConfig = {
  region: string | null;
  accessKeyIdMasked: string | null;
  hasSecretKey: boolean;
  configurationSet: string | null;
  snsTopicArn: string | null;
  defaultFromEmail: string | null;
  defaultFromName: string | null;
  appUrl: string | null;
  snsWebhookUrl: string | null;
  hasTrackingSecret: boolean;
  hasSnsWebhookSecret: boolean;
  missing: string[];
  healthy: boolean;
  lastSnsEvent: { event_type: string; received_at: string } | null;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono break-all">
        {value || <span className="text-muted-foreground">— not configured —</span>}
      </div>
    </div>
  );
}

function SesPage() {
  const [cfg, setCfg] = useState<SesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<SesConfig>("/api/settings/ses");
      setCfg(data);
      setTestTo((prev) => prev || data.defaultFromEmail || "");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      const res = await fn();
      toast.success(`${label}: ${JSON.stringify(res)}`);
    } catch (e: any) {
      toast.error(`${label} failed: ${e.message}`);
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <>
      <PageHeader
        title="SES Configuration"
        description="AWS SES integration — credentials live in the backend .env."
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge variant={cfg?.healthy ? "default" : "destructive"}>
          {cfg?.healthy ? "Configuration healthy" : "Configuration incomplete"}
        </Badge>
        {cfg && cfg.missing.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Missing: {cfg.missing.join(", ")}
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Credentials (read-only)</CardTitle>
            <CardDescription>Set these in the backend .env, then restart the API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="AWS Region" value={cfg?.region} />
            <Field label="AWS Access Key ID" value={cfg?.accessKeyIdMasked} />
            <Field
              label="AWS Secret Access Key"
              value={cfg?.hasSecretKey ? "•••••• (set)" : null}
            />
            <Field label="Tracking Secret" value={cfg?.hasTrackingSecret ? "•••••• (set)" : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sender & Configuration Set</CardTitle>
            <CardDescription>Default sender identity used for all sends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Default From Name" value={cfg?.defaultFromName} />
            <Field label="Default From Email" value={cfg?.defaultFromEmail} />
            <Field label="SES Configuration Set" value={cfg?.configurationSet} />
            <Field label="SES → SNS Topic ARN" value={cfg?.snsTopicArn} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Test Tools</CardTitle>
            <CardDescription>
              Validate AWS credentials, sender identity, and send a single test email. No
              campaign emails are sent here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("Credentials", () =>
                    api("/api/settings/ses/test-credentials", { method: "POST" }),
                  )
                }
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Test AWS Credentials
              </Button>
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("Identity", () =>
                    api("/api/settings/ses/test-identity", { method: "POST", body: {} }),
                  )
                }
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Verify Sender Identity
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="recipient@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <Button
                disabled={busy !== null || !testTo}
                onClick={() =>
                  run("Test email", () =>
                    api("/api/settings/ses/test-email", {
                      method: "POST",
                      body: { to: testTo },
                    }),
                  )
                }
              >
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </Button>
            </div>
            {cfg?.lastSnsEvent && (
              <div className="text-xs text-muted-foreground">
                Last SNS event: <span className="font-mono">{cfg.lastSnsEvent.event_type}</span>{" "}
                at {new Date(cfg.lastSnsEvent.received_at).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
