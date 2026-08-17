import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { settingsApi, type SettingsMap, type SettingsKey } from "@/lib/settingsApi";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:w-72">{children}</div>
    </div>
  );
}

function SectionCard<K extends SettingsKey>({
  k, title, description, value, onSave, render,
}: {
  k: K;
  title: string;
  description?: string;
  value: SettingsMap[K];
  onSave: (key: K, value: SettingsMap[K]) => Promise<void>;
  render: (v: SettingsMap[K], set: (patch: Partial<SettingsMap[K]>) => void) => React.ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {render(draft, (patch) => setDraft({ ...draft, ...patch } as SettingsMap[K]))}
        <div className="flex justify-end pt-4">
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onSave(k, draft); toast.success(`${title} saved`); }
              catch (e: any) { toast.error("Save failed", { description: e?.message }); }
              finally { setSaving(false); }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save {title}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type ProviderName = "ses" | "brevo";

function ProviderTestRow({ label, endpoint }: { label: string; endpoint: string }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        className="sm:w-72"
        placeholder={`Send ${label} test to…`}
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <Button
        variant="outline"
        disabled={busy || !to.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ ok: boolean; message_id?: string | null }>(endpoint, {
              method: "POST",
              body: { to: to.trim() },
            });
            toast.success(`${label} test sent`, { description: r.message_id || undefined });
          } catch (e: any) {
            toast.error(`${label} test failed`, { description: e?.message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Send {label} test
      </Button>
    </div>
  );
}

function EmailProviderCard({
  value, onSave,
}: {
  value: { provider: ProviderName };
  onSave: (v: { provider: ProviderName }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ProviderName>(value.provider || "ses");
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value.provider || "ses"), [value.provider]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email provider
          <Badge variant="secondary">
            Active: {value.provider === "brevo" ? "Brevo" : "AWS SES"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Choose which service sends campaigns by default. AWS SES stays selected unless you change it.
          Credentials for both providers live only in server-side environment variables.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Row label="Default provider" description="Campaigns can still override this individually.">
          <Select value={draft} onValueChange={(v) => setDraft(v as ProviderName)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ses">AWS SES</SelectItem>
              <SelectItem value="brevo">Brevo</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="AWS SES test email" description="Uses DEFAULT_FROM_EMAIL. Does not change any setting.">
          <ProviderTestRow label="SES" endpoint="/api/settings/ses/test-email" />
        </Row>
        <Row label="Brevo test email" description="Uses BREVO_SENDER_EMAIL. Does not change the active provider.">
          <ProviderTestRow label="Brevo" endpoint="/api/settings/brevo/test-email" />
        </Row>
        <div className="flex justify-end pt-4">
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onSave({ provider: draft }); toast.success("Email provider saved"); }
              catch (e: any) { toast.error("Save failed", { description: e?.message }); }
              finally { setSaving(false); }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save provider
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.load();
      setSettings(res.settings);
    } catch (e: any) {
      toast.error("Failed to load settings", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async <K extends SettingsKey>(k: K, v: SettingsMap[K]) => {
    await settingsApi.save(k, v);
    setSettings((cur) => (cur ? { ...cur, [k]: v } : cur));
  };

  if (loading || !settings) {
    return (
      <>
        <PageHeader title="Settings" description="Configure workspace, sending, tracking, and branding." />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Stored in app_settings. Secrets (AWS keys, JWT, SNS secret) remain in env variables."
      />

      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sending">Sending</TabsTrigger>
          <TabsTrigger value="provider">Email provider</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="unsubscribe">Unsubscribe</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <SectionCard k="general" title="General" description="Workspace basics."
            value={settings.general} onSave={save}
            render={(v, set) => (<>
              <Row label="Workspace name">
                <Input value={v.workspace_name} onChange={(e) => set({ workspace_name: e.target.value })} />
              </Row>
              <Row label="Default timezone">
                <Input value={v.timezone} onChange={(e) => set({ timezone: e.target.value })} />
              </Row>
              <Row label="Support email">
                <Input value={v.support_email} onChange={(e) => set({ support_email: e.target.value })} />
              </Row>
            </>)}
          />
        </TabsContent>

        <TabsContent value="sending">
          <SectionCard k="sending" title="Sending" description="Throughput and retry behavior."
            value={settings.sending} onSave={save}
            render={(v, set) => (<>
              <Row label="Max send rate (per second)">
                <Input type="number" value={v.max_send_rate_per_sec}
                  onChange={(e) => set({ max_send_rate_per_sec: Number(e.target.value) })} />
              </Row>
              <Row label="Max retries">
                <Input type="number" value={v.max_retries}
                  onChange={(e) => set({ max_retries: Number(e.target.value) })} />
              </Row>
              <Row label="Throttle on bounce spike"
                description="Automatically pause when bounce rate exceeds threshold.">
                <Switch checked={v.throttle_on_bounce_spike}
                  onCheckedChange={(c) => set({ throttle_on_bounce_spike: c })} />
              </Row>
              <Row label="Bounce spike threshold (%)">
                <Input type="number" value={v.bounce_spike_threshold_pct}
                  onChange={(e) => set({ bounce_spike_threshold_pct: Number(e.target.value) })} />
              </Row>
            </>)}
          />
        </TabsContent>

        <TabsContent value="provider">
          <EmailProviderCard
            value={settings.email_provider}
            onSave={(v) => save("email_provider", v)}
          />
        </TabsContent>

        <TabsContent value="tracking">
          <SectionCard k="tracking" title="Tracking" value={settings.tracking} onSave={save}
            render={(v, set) => (<>
              <Row label="Open tracking" description="Embed a 1×1 pixel.">
                <Switch checked={v.open_tracking} onCheckedChange={(c) => set({ open_tracking: c })} />
              </Row>
              <Row label="Click tracking" description="Rewrite links through tracker.">
                <Switch checked={v.click_tracking} onCheckedChange={(c) => set({ click_tracking: c })} />
              </Row>
              <Row label="Tracking domain">
                <Input value={v.tracking_domain} onChange={(e) => set({ tracking_domain: e.target.value })}
                  placeholder="track.yourdomain.com" />
              </Row>
            </>)}
          />
        </TabsContent>

        <TabsContent value="unsubscribe">
          <SectionCard k="unsubscribe" title="Unsubscribe" value={settings.unsubscribe} onSave={save}
            render={(v, set) => (<>
              <Row label="One-click unsubscribe (RFC 8058)">
                <Switch checked={v.one_click} onCheckedChange={(c) => set({ one_click: c })} />
              </Row>
              <Row label="Footer text">
                <Textarea rows={3} value={v.footer_text}
                  onChange={(e) => set({ footer_text: e.target.value })} />
              </Row>
            </>)}
          />
        </TabsContent>

        <TabsContent value="branding">
          <SectionCard k="branding" title="Branding" value={settings.branding} onSave={save}
            render={(v, set) => (<>
              <Row label="Brand color">
                <Input value={v.brand_color} onChange={(e) => set({ brand_color: e.target.value })} />
              </Row>
              <Row label="Logo URL">
                <Input value={v.logo_url} onChange={(e) => set({ logo_url: e.target.value })}
                  placeholder="https://…/logo.png" />
              </Row>
              <Row label="Reply-to address">
                <Input value={v.reply_to} onChange={(e) => set({ reply_to: e.target.value })} />
              </Row>
            </>)}
          />
        </TabsContent>

        <TabsContent value="safety">
          <SectionCard k="safety" title="Safety Limits" value={settings.safety} onSave={save}
            render={(v, set) => (<>
              <Row label="Max daily sends">
                <Input type="number" value={v.max_daily_sends}
                  onChange={(e) => set({ max_daily_sends: Number(e.target.value) })} />
              </Row>
              <Row label="Max per campaign">
                <Input type="number" value={v.max_per_campaign}
                  onChange={(e) => set({ max_per_campaign: Number(e.target.value) })} />
              </Row>
              <Row label="Require double opt-in">
                <Switch checked={v.require_double_optin}
                  onCheckedChange={(c) => set({ require_double_optin: c })} />
              </Row>
            </>)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
