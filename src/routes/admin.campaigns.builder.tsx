import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ChevronLeft, ChevronRight, Save, Send, FlaskConical,
  Mail, Users, FileCode, Shield, ClipboardCheck, Rocket,
  Monitor, Smartphone, Moon, Sun, AlertTriangle, CheckCircle2,
  CloudCog, Radio, Eye, MousePointerClick, ShieldAlert, UserMinus, Clock,
  CircleDashed, Sparkles, Calendar, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_REPLY_TO } from "@/lib/email-defaults";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { listTemplates, getTemplate, type Template } from "@/lib/templatesApi";
import { listLists, type ListRow } from "@/lib/contactsApi";
import {
  createCampaign, updateCampaign, sendCampaign, sendTestEmail,
} from "@/lib/campaignsApi";

export const Route = createFileRoute("/admin/campaigns/builder")({
  component: BuilderPage,
});

type StepKey = "setup" | "audience" | "content" | "tracking" | "review" | "send";

const STEPS: { key: StepKey; name: string; description: string; icon: typeof Mail }[] = [
  { key: "setup",    name: "Setup",      description: "Subject & sender",      icon: Mail },
  { key: "audience", name: "Audience",   description: "Recipients & segments", icon: Users },
  { key: "content",  name: "Content",    description: "Template & preview",    icon: FileCode },
  { key: "tracking", name: "Tracking",   description: "SES, SNS & checks",     icon: Shield },
  { key: "review",   name: "Review",     description: "Final summary",         icon: ClipboardCheck },
  { key: "send",     name: "Send",       description: "Schedule or launch",    icon: Rocket },
];

type SesInfo = {
  region?: string | null;
  configurationSet?: string | null;
  snsTopicArn?: string | null;
  defaultFromEmail?: string | null;
  defaultFromName?: string | null;
  appUrl?: string | null;
  snsWebhookUrl?: string | null;
  hasTrackingSecret?: boolean;
  missing?: string[];
  healthy?: boolean;
};

const fmt = new Intl.NumberFormat("en-US");

function BuilderPage() {
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const stepKey = STEPS[stepIdx].key;

  // data
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [ses, setSes] = useState<SesInfo>({});

  // step 1 — setup
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  // "" = use the workspace default provider (AWS SES unless changed in Settings)
  const [provider, setProvider] = useState<"" | "ses" | "brevo">("");

  // step 2 — audience
  const [listIds, setListIds] = useState<string[]>([]);   // selected (multi)
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const primaryListId = listIds[0] ?? "";

  // step 3 — content
  const [templateId, setTemplateId] = useState<string>("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewDark, setPreviewDark] = useState(false);

  // step 4 — tracking
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);
  const [trackBounces, setTrackBounces] = useState(true);
  const [trackComplaints, setTrackComplaints] = useState(true);
  const [trackUnsubs, setTrackUnsubs] = useState(true);

  // step 6 — send
  const [scheduleAt, setScheduleAt] = useState<string>("");

  // meta
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmailAddr] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);

  // load
  useEffect(() => {
    (async () => {
      try {
        const [t, l, sesInfo] = await Promise.all([
          listTemplates(),
          listLists(),
          api<SesInfo>(`/api/settings/ses`).catch(() => ({} as SesInfo)),
        ]);
        setTemplates(t);
        setLists(l.data);
        setSes(sesInfo);
        if (sesInfo.defaultFromEmail) setFromEmail((v) => v || sesInfo.defaultFromEmail!);
        if (sesInfo.defaultFromName) setFromName((v) => v || sesInfo.defaultFromName!);
        setReplyTo((v) => v || DEFAULT_REPLY_TO);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load builder data");
      }
    })();
  }, []);

  // mark dirty on any field change
  useEffect(() => { setDirty(true); }, [
    name, subject, previewText, fromName, fromEmail, replyTo,
    listIds, excludeIds, templateId, htmlBody, textBody,
    trackOpens, trackClicks, trackBounces, trackComplaints, trackUnsubs,
    scheduleAt,
  ]);

  // hydrate body when template changes
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      try {
        const full = await getTemplate(templateId);
        setHtmlBody(full.html_body);
        setTextBody(full.text_body || "");
        if (!subject) setSubject(full.subject);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load template");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // ---------- derived ----------

  const selectedLists = useMemo(
    () => lists.filter((l) => listIds.includes(l.id)),
    [lists, listIds],
  );
  const excludedLists = useMemo(
    () => lists.filter((l) => excludeIds.includes(l.id)),
    [lists, excludeIds],
  );
  // Real audience counts from the backend (same query the send path uses).
  // Falls back to fast client-side estimates while the request is in flight.
  const [audience, setAudience] = useState<{
    total: number; deliverable: number; suppressed: number;
    unsubscribed: number; invalid: number; duplicate: number;
  } | null>(null);
  useEffect(() => {
    if (listIds.length === 0) { setAudience(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ counts: typeof audience }>("/api/campaigns/preview-audience", {
          method: "POST",
          body: { list_ids: listIds, exclude_list_ids: excludeIds },
        });
        if (!cancelled) setAudience(res.counts);
      } catch {
        if (!cancelled) setAudience(null);
      }
    })();
    return () => { cancelled = true; };
  }, [listIds.join(","), excludeIds.join(",")]);

  const selectedTotal = selectedLists.reduce((s, l) => s + l.member_count, 0);
  const excludedContacts = excludedLists.reduce((s, l) => s + l.member_count, 0);
  const totalContacts = audience?.total ?? selectedTotal;
  const suppressedEst = audience?.suppressed ?? 0;
  const unsubEst = audience?.unsubscribed ?? 0;
  const invalidEst = audience?.invalid ?? 0;
  const duplicateEst = audience?.duplicate ?? 0;
  const deliverableEst = audience?.deliverable ?? Math.max(0, selectedTotal - excludedContacts);
  const estSendSeconds = Math.ceil(deliverableEst / 14); // SES quota MaxSendRate ≈ 14/s default


  const subjectLen = subject.length;
  const previewLen = previewText.length;

  const selectedTemplate = templates.find((t) => t.id === templateId);

  const checks = useMemo(() => {
    const list: { ok: boolean; label: string; hint?: string }[] = [];
    list.push({ ok: !!fromEmail, label: "Sender address set" });
    list.push({ ok: !!fromName, label: "From name set" });
    list.push({ ok: subjectLen >= 5 && subjectLen <= 78, label: "Subject length 5–78 chars", hint: `${subjectLen} chars` });
    list.push({ ok: previewLen >= 30 && previewLen <= 120, label: "Preview text 30–120 chars", hint: `${previewLen} chars` });
    list.push({ ok: !!htmlBody, label: "HTML body present" });
    list.push({ ok: !!textBody, label: "Plain text version present" });
    const hasUnsub = /\{\{\s*unsubscribe_url\s*\}\}|unsubscribe/i.test(htmlBody);
    list.push({ ok: hasUnsub, label: "Unsubscribe link in HTML" });
    list.push({ ok: trackOpens || trackClicks, label: "Open or click tracking enabled" });
    list.push({ ok: !!ses.configurationSet, label: "SES configuration set bound", hint: ses.configurationSet || undefined });
    list.push({ ok: !!ses.snsTopicArn, label: "SNS topic configured" });
    list.push({ ok: deliverableEst > 0, label: "At least one deliverable recipient" });
    return list;
  }, [fromEmail, fromName, subjectLen, previewLen, htmlBody, textBody, trackOpens, trackClicks, ses, deliverableEst]);

  const blockingChecks = checks.filter((c) => !c.ok && !c.label.includes("Plain text") && !c.label.includes("Preview text"));
  const canLaunch = blockingChecks.length === 0;

  // ---------- save / send ----------

  const buildPayload = () => ({
    name: name.trim(),
    template_id: templateId || undefined,
    list_ids: listIds,
    subject: subject.trim(),
    html_body: htmlBody,
    text_body: textBody || undefined,
    from_email: fromEmail.trim(),
    from_name: fromName.trim(),
    reply_to: replyTo.trim() || null,
    provider: provider || null,
    scheduled_at: scheduleAt || undefined,
  });

  const persistDraft = async (silent = false): Promise<{ id: string } | null> => {
    if (!name.trim()) { if (!silent) toast.error("Campaign name is required"); return null; }
    if (!primaryListId) { if (!silent) toast.error("Pick at least one list"); return null; }
    if (!subject.trim()) { if (!silent) toast.error("Subject is required"); return null; }
    if (!htmlBody) { if (!silent) toast.error("Pick a template first"); return null; }
    if (!fromEmail.trim() || !fromName.trim()) { if (!silent) toast.error("Sender details required"); return null; }
    setSaving(true);
    try {
      const payload = buildPayload();
      const c = campaignId
        ? await updateCampaign(campaignId, payload)
        : await createCampaign(payload);
      setCampaignId(c.id);
      setLastSavedAt(Date.now());
      setDirty(false);
      if (!silent) toast.success("Draft saved");
      return c;
    } catch (e: any) {
      if (!silent) toast.error(e?.message || "Save failed");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // autosave debounced
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      if (name.trim() && primaryListId && subject.trim() && htmlBody && fromEmail && fromName) {
        persistDraft(true);
      }
    }, 4000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, primaryListId, subject, htmlBody, fromEmail, fromName]);

  const onSendTest = async () => {
    if (!testEmail.trim()) { toast.error("Enter an email"); return; }
    setSendingTest(true);
    try {
      let cid = campaignId;
      if (!cid) {
        const c = await persistDraft();
        if (!c) return;
        cid = c.id;
      }
      await sendTestEmail(cid, testEmail.trim());
      toast.success(`Test sent to ${testEmail} via SES`);
      setTestOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setSendingTest(false);
    }
  };

  const onLaunch = async () => {
    setSendingNow(true);
    try {
      let cid = campaignId;
      if (!cid) {
        const c = await persistDraft();
        if (!c) return;
        cid = c.id;
      }
      const r = await sendCampaign(cid);
      toast.success(`Queued ${fmt.format(r.queued)} recipients into SES`);
      setLaunchOpen(false);
      navigate({ to: "/admin/campaigns/$id", params: { id: cid } });
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally {
      setSendingNow(false);
    }
  };

  const goNext = () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
  const goBack = () => setStepIdx((i) => Math.max(0, i - 1));

  // ---------- render ----------

  return (
    <div className="pb-32">
      <PageHeader
        title="Campaign Builder"
        description="Configure, preview, and launch through AWS SES with SNS event tracking."
        actions={
          <>
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : lastSavedAt ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved {timeAgo(lastSavedAt)}</>
              ) : dirty ? (
                <><CircleDashed className="h-3.5 w-3.5" /> Unsaved changes</>
              ) : null}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/campaigns">Cancel</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => persistDraft()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />Save Draft
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
              <FlaskConical className="mr-2 h-4 w-4" />Send Test
            </Button>
          </>
        }
      />

      {/* Step indicator */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {stepIdx + 1} of {STEPS.length}</span>
            <span>{Math.round(((stepIdx + 1) / STEPS.length) * 100)}% complete</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
              style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <button
                  key={s.key}
                  onClick={() => setStepIdx(i)}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition",
                    active && "border-primary bg-primary/5 shadow-sm",
                    done && "border-emerald-500/30 bg-emerald-500/5",
                    !active && !done && "border-border hover:bg-accent/50",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      active && "bg-primary text-primary-foreground",
                      done && "bg-emerald-500 text-white",
                      !active && !done && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{s.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step content */}
      {stepKey === "setup" && (
        <StepSetup
          name={name} setName={setName}
          subject={subject} setSubject={setSubject}
          previewText={previewText} setPreviewText={setPreviewText}
          fromName={fromName} setFromName={setFromName}
          fromEmail={fromEmail} setFromEmail={setFromEmail}
          replyTo={replyTo} setReplyTo={setReplyTo}
          provider={provider} setProvider={setProvider}
          ses={ses}
        />
      )}

      {stepKey === "audience" && (
        <StepAudience
          lists={lists}
          listIds={listIds} setListIds={setListIds}
          excludeIds={excludeIds} setExcludeIds={setExcludeIds}
          totalContacts={totalContacts}
          excludedContacts={excludedContacts}
          suppressedEst={suppressedEst}
          unsubEst={unsubEst}
          deliverableEst={deliverableEst}
        />
      )}

      {stepKey === "content" && (
        <StepContent
          templates={templates}
          templateId={templateId} setTemplateId={setTemplateId}
          subject={subject} previewText={previewText} fromName={fromName} fromEmail={fromEmail}
          htmlBody={htmlBody} setHtmlBody={setHtmlBody}
          textBody={textBody} setTextBody={setTextBody}
          previewDevice={previewDevice} setPreviewDevice={setPreviewDevice}
          previewDark={previewDark} setPreviewDark={setPreviewDark}
        />
      )}

      {stepKey === "tracking" && (
        <StepTracking
          ses={ses}
          trackOpens={trackOpens} setTrackOpens={setTrackOpens}
          trackClicks={trackClicks} setTrackClicks={setTrackClicks}
          trackBounces={trackBounces} setTrackBounces={setTrackBounces}
          trackComplaints={trackComplaints} setTrackComplaints={setTrackComplaints}
          trackUnsubs={trackUnsubs} setTrackUnsubs={setTrackUnsubs}
          checks={checks}
        />
      )}

      {stepKey === "review" && (
        <StepReview
          name={name} subject={subject} previewText={previewText}
          fromName={fromName} fromEmail={fromEmail} replyTo={replyTo}
          selectedLists={selectedLists} excludedLists={excludedLists}
          totalContacts={totalContacts} deliverableEst={deliverableEst}
          suppressedEst={suppressedEst} unsubEst={unsubEst}
          template={selectedTemplate}
          ses={ses}
          tracking={{ trackOpens, trackClicks, trackBounces, trackComplaints, trackUnsubs }}
          checks={checks}
        />
      )}

      {stepKey === "send" && (
        <StepSend
          name={name}
          deliverableEst={deliverableEst}
          estSendSeconds={estSendSeconds}
          ses={ses}
          scheduleAt={scheduleAt} setScheduleAt={setScheduleAt}
          canLaunch={canLaunch}
          onLaunch={() => setLaunchOpen(true)}
          onSaveDraft={() => persistDraft()}
          onSendTest={() => setTestOpen(true)}
          saving={saving}
        />
      )}

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <Button variant="ghost" onClick={goBack} disabled={stepIdx === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Badge variant="outline" className="font-normal">{STEPS[stepIdx].name}</Badge>
            <span>•</span>
            <span>{primaryListId ? `${fmt.format(deliverableEst)} deliverable` : "No audience yet"}</span>
          </div>
          {stepIdx < STEPS.length - 1 ? (
            <Button onClick={goNext}>
              Continue<ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setLaunchOpen(true)} disabled={!canLaunch || sendingNow}>
              <Send className="mr-2 h-4 w-4" />Launch Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Test dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send test email via AWS SES</DialogTitle>
            <DialogDescription>
              Sends a single test through your configured SES identity. Draft is saved first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Recipient</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmailAddr(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={sendingTest}>Cancel</Button>
            <Button onClick={onSendTest} disabled={sendingTest}>
              {sendingTest ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Launch confirmation */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch "{name || "campaign"}"?</DialogTitle>
            <DialogDescription>
              This will queue every deliverable recipient and start sending through AWS SES immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <Stat label="Deliverable" value={fmt.format(deliverableEst)} />
            <Stat label="Est. send time" value={formatDuration(estSendSeconds)} />
            <Stat label="SES region" value={ses.region || "—"} />
            <Stat label="Config set" value={ses.configurationSet || "—"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLaunchOpen(false)} disabled={sendingNow}>Cancel</Button>
            <Button onClick={onLaunch} disabled={sendingNow}>
              {sendingNow ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Queuing…</> : <><Send className="mr-2 h-4 w-4" />Launch Now</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============= STEP 1 =============

function StepSetup(props: {
  name: string; setName: (v: string) => void;
  subject: string; setSubject: (v: string) => void;
  previewText: string; setPreviewText: (v: string) => void;
  fromName: string; setFromName: (v: string) => void;
  fromEmail: string; setFromEmail: (v: string) => void;
  replyTo: string; setReplyTo: (v: string) => void;
  provider: "" | "ses" | "brevo"; setProvider: (v: "" | "ses" | "brevo") => void;
  ses: SesInfo;
}) {
  const { name, setName, subject, setSubject, previewText, setPreviewText,
    fromName, setFromName, fromEmail, setFromEmail, replyTo, setReplyTo,
    provider, setProvider, ses } = props;

  const subjMeter = bounded(subject.length, 5, 78);
  const previewMeter = bounded(previewText.length, 30, 120);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail);
  const replyOk = !replyTo || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo);
  const domainMatchesSes = ses.defaultFromEmail && fromEmail.endsWith(`@${ses.defaultFromEmail.split("@")[1]}`);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
          <CardDescription>Internal name plus what the recipient will see in their inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label>Campaign name <span className="text-muted-foreground">(internal)</span></Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="November Newsletter — Cohort A" />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Email subject</Label>
              <span className={cn("text-xs tabular-nums", subjMeter.tone)}>{subject.length} chars · {subjMeter.label}</span>
            </div>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Your November update is here ✨" />
            <Meter value={subject.length} min={5} max={78} />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Preview text</Label>
              <span className={cn("text-xs tabular-nums", previewMeter.tone)}>{previewText.length} chars · {previewMeter.label}</span>
            </div>
            <Textarea
              rows={2}
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="A short snippet shown in the inbox after the subject line."
            />
            <Meter value={previewText.length} min={30} max={120} />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>From name</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="HSENations" />
            </div>
            <div className="grid gap-2">
              <Label>From email</Label>
              <Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="marketing@yourdomain.com" />
              <span className={cn("text-xs", emailOk ? "text-emerald-500" : "text-muted-foreground")}>
                {emailOk ? (domainMatchesSes ? "Matches your SES verified domain" : "Valid format — verify in AWS SES") : "Enter a valid email"}
              </span>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Reply-To email <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="support@yourdomain.com" />
              {!replyOk && <span className="text-xs text-destructive">Invalid email format</span>}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Sending provider</Label>
              <Select value={provider || "default"} onValueChange={(v) => setProvider(v === "default" ? "" : (v as "ses" | "brevo"))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Workspace default</SelectItem>
                  <SelectItem value="ses">AWS SES</SelectItem>
                  <SelectItem value="brevo">Brevo</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Leave on workspace default to keep using the provider selected in Settings (AWS SES unless changed).
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Inbox preview</CardTitle>
          <CardDescription>How this lands in a recipient's mailbox.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-bold text-primary-foreground">
                {(fromName || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{fromName || "Sender name"}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">now</span>
                </div>
                <div className="truncate text-sm font-medium">{subject || "Email subject"}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {previewText || "Preview text appears here after the subject…"}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <SesPill label="SES region" value={ses.region} />
            <SesPill label="Config set" value={ses.configurationSet} />
            <SesPill label="Default identity" value={ses.defaultFromEmail} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= STEP 2 =============

function StepAudience(props: {
  lists: ListRow[];
  listIds: string[]; setListIds: (v: string[]) => void;
  excludeIds: string[]; setExcludeIds: (v: string[]) => void;
  totalContacts: number; excludedContacts: number;
  suppressedEst: number; unsubEst: number; deliverableEst: number;
}) {
  const { lists, listIds, setListIds, excludeIds, setExcludeIds,
    totalContacts, excludedContacts, suppressedEst, unsubEst, deliverableEst } = props;

  const toggle = (id: string, arr: string[], setter: (v: string[]) => void) =>
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Recipient lists</CardTitle>
            <CardDescription>
              Pick one or more lists. The campaign is sent to the union of
              every selected list (duplicates are de-duplicated automatically).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <EmptyState
                title="No lists yet"
                description="Create a contact list to send your first campaign."
                cta={<Link to="/admin/lists" className="text-primary underline">Manage lists</Link>}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {lists.map((l) => {
                  const sel = listIds.includes(l.id);
                  const primary = listIds[0] === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggle(l.id, listIds, setListIds)}
                      className={cn(
                        "group relative flex items-start gap-3 rounded-xl border p-4 text-left transition",
                        sel ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-accent/50",
                      )}
                    >
                      <Checkbox checked={sel} className="mt-0.5" tabIndex={-1} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{l.name}</span>
                          {primary && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">PRIMARY</Badge>}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{l.description || "No description"}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground tabular-nums">{fmt.format(l.member_count)}</span> contacts
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserMinus className="h-4 w-4" />Exclude lists</CardTitle>
            <CardDescription>Contacts on any excluded list are removed from the estimate.</CardDescription>
          </CardHeader>
          <CardContent>
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lists available.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lists.map((l) => {
                  const sel = excludeIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggle(l.id, excludeIds, setExcludeIds)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs transition",
                        sel ? "border-destructive bg-destructive/10 text-destructive" : "hover:bg-accent/50",
                      )}
                    >
                      {sel && <Check className="mr-1 inline h-3 w-3" />}
                      {l.name} <span className="text-muted-foreground">({fmt.format(l.member_count)})</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader>
          <CardTitle>Estimated reach</CardTitle>
          <CardDescription>Final numbers compute server-side at queue time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ReachRow label="Total selected" value={totalContacts} tone="muted" />
          <ReachRow label="Excluded" value={-excludedContacts} tone="destructive" />
          <ReachRow label="Suppressed (est.)" value={-suppressedEst} tone="warning" />
          <ReachRow label="Unsubscribed (est.)" value={-unsubEst} tone="warning" />
          <Separator />
          <div className="rounded-lg border bg-primary/5 p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Deliverable</div>
            <div className="text-3xl font-black tabular-nums">{fmt.format(deliverableEst)}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= STEP 3 =============

function StepContent(props: {
  templates: Template[];
  templateId: string; setTemplateId: (v: string) => void;
  subject: string; previewText: string; fromName: string; fromEmail: string;
  htmlBody: string; setHtmlBody: (v: string) => void;
  textBody: string; setTextBody: (v: string) => void;
  previewDevice: "desktop" | "mobile"; setPreviewDevice: (v: "desktop" | "mobile") => void;
  previewDark: boolean; setPreviewDark: (v: boolean) => void;
}) {
  const { templates, templateId, setTemplateId, subject, previewText, fromName,
    htmlBody, setHtmlBody, textBody, setTextBody, previewDevice, setPreviewDevice,
    previewDark, setPreviewDark } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Email content</CardTitle>
          <CardDescription>Pick a template or edit the HTML and plain-text version.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-2">
            <Label>Template</Label>
            {templates.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No templates yet. <Link to="/admin/templates" className="text-primary underline">Create one</Link>.
              </div>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Loading a template populates HTML, plain text and falls back the subject.
              Edits below override the template for this campaign only.
            </p>
          </div>

          <Tabs defaultValue="html">
            <TabsList>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="text">Plain text</TabsTrigger>
            </TabsList>
            <TabsContent value="html" className="mt-3">
              <Textarea
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                rows={18}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder="<html>…</html>"
              />
            </TabsContent>
            <TabsContent value="text" className="mt-3">
              <Textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={18}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder="Plain-text version improves deliverability and accessibility."
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>Inbox, desktop, mobile and dark mode.</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={cn("rounded-md px-2 py-1 text-xs", previewDevice === "desktop" && "bg-accent")}
                title="Desktop"
              ><Monitor className="h-3.5 w-3.5" /></button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={cn("rounded-md px-2 py-1 text-xs", previewDevice === "mobile" && "bg-accent")}
                title="Mobile"
              ><Smartphone className="h-3.5 w-3.5" /></button>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <button
                onClick={() => setPreviewDark(!previewDark)}
                className={cn("rounded-md px-2 py-1 text-xs", previewDark && "bg-accent")}
                title="Toggle dark"
              >{previewDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}</button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Inbox header */}
          <div className={cn(
            "rounded-t-xl border-b-0 border p-3 text-sm",
            previewDark ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "bg-muted/30",
          )}>
            <div className="text-[11px] uppercase tracking-wider opacity-60">From</div>
            <div className="font-medium">{fromName || "Sender"}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider opacity-60">Subject</div>
            <div className="font-semibold">{subject || "(no subject)"}</div>
            {previewText && (
              <div className="mt-1 text-xs opacity-70">{previewText}</div>
            )}
          </div>
          <div className={cn(
            "overflow-hidden rounded-b-xl border bg-background",
            previewDark && "border-zinc-700 bg-zinc-900",
          )}>
            <ScrollArea className="h-[480px]">
              <div className={cn("mx-auto", previewDevice === "mobile" ? "max-w-[375px]" : "w-full")}>
                {htmlBody ? (
                  <iframe
                    title="email-preview"
                    srcDoc={previewDark ? wrapDark(htmlBody) : htmlBody}
                    className="h-[480px] w-full border-0 bg-white"
                  />
                ) : (
                  <div className="grid h-[480px] place-items-center text-sm text-muted-foreground">
                    Pick a template or paste HTML to preview.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= STEP 4 =============

function StepTracking(props: {
  ses: SesInfo;
  trackOpens: boolean; setTrackOpens: (v: boolean) => void;
  trackClicks: boolean; setTrackClicks: (v: boolean) => void;
  trackBounces: boolean; setTrackBounces: (v: boolean) => void;
  trackComplaints: boolean; setTrackComplaints: (v: boolean) => void;
  trackUnsubs: boolean; setTrackUnsubs: (v: boolean) => void;
  checks: { ok: boolean; label: string; hint?: string }[];
}) {
  const { ses, trackOpens, setTrackOpens, trackClicks, setTrackClicks,
    trackBounces, setTrackBounces, trackComplaints, setTrackComplaints,
    trackUnsubs, setTrackUnsubs, checks } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" />Campaign tracking</CardTitle>
          <CardDescription>Toggle which interaction events the campaign collects.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <TrackRow icon={Eye} label="Open tracking" hint="1×1 pixel via SES open tracking" checked={trackOpens} onChange={setTrackOpens} />
          <TrackRow icon={MousePointerClick} label="Click tracking" hint="Link wrapping with redirect" checked={trackClicks} onChange={setTrackClicks} />
          <TrackRow icon={AlertTriangle} label="Bounce tracking" hint="SES → SNS Bounce events" checked={trackBounces} onChange={setTrackBounces} />
          <TrackRow icon={ShieldAlert} label="Complaint tracking" hint="SES → SNS Complaint events" checked={trackComplaints} onChange={setTrackComplaints} />
          <TrackRow icon={UserMinus} label="Unsubscribe tracking" hint="One-click unsubscribe + List-Unsubscribe header" checked={trackUnsubs} onChange={setTrackUnsubs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudCog className="h-4 w-4" />AWS SES delivery</CardTitle>
          <CardDescription>The IAM credentials, region and configuration set used to send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <KV label="Region" value={ses.region} mono />
          <KV label="Configuration set" value={ses.configurationSet} mono />
          <KV label="Default identity" value={ses.defaultFromEmail} mono />
          <KV label="App URL" value={ses.appUrl} mono />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4" />AWS SNS events</CardTitle>
          <CardDescription>SES publishes these event types to your SNS topic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <KV label="Topic ARN" value={ses.snsTopicArn} mono />
          <KV label="Webhook endpoint" value={ses.snsWebhookUrl} mono />
          <div className="mt-2 flex flex-wrap gap-2">
            {["Delivery", "Bounce", "Complaint", "Open", "Click", "Reject", "DeliveryDelay"].map((e) => (
              <Badge key={e} variant="secondary" className="font-mono text-[11px]">{e}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />Deliverability checks</CardTitle>
          <CardDescription>Issues that could hurt inbox placement.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="flex items-center gap-2.5">
                  {c.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span>{c.label}</span>
                </span>
                {c.hint && <span className="text-xs text-muted-foreground">{c.hint}</span>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============= STEP 5 =============

function StepReview(props: {
  name: string; subject: string; previewText: string;
  fromName: string; fromEmail: string; replyTo: string;
  selectedLists: ListRow[]; excludedLists: ListRow[];
  totalContacts: number; deliverableEst: number;
  suppressedEst: number; unsubEst: number;
  template?: Template;
  ses: SesInfo;
  tracking: { trackOpens: boolean; trackClicks: boolean; trackBounces: boolean; trackComplaints: boolean; trackUnsubs: boolean };
  checks: { ok: boolean; label: string; hint?: string }[];
}) {
  const { name, subject, previewText, fromName, fromEmail, replyTo,
    selectedLists, excludedLists, totalContacts, deliverableEst, suppressedEst, unsubEst,
    template, ses, tracking, checks } = props;

  const enabledTracks = Object.entries(tracking).filter(([, v]) => v).map(([k]) => k);
  const issues = checks.filter((c) => !c.ok);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{name || "Untitled campaign"}</CardTitle>
          <CardDescription>{subject || "No subject"} {previewText && `· ${previewText}`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReviewSection title="Campaign summary">
            <KV label="Subject" value={subject} />
            <KV label="Preview text" value={previewText || "—"} />
            <KV label="From" value={fromName ? `${fromName} <${fromEmail}>` : fromEmail} />
            <KV label="Reply-To" value={replyTo || fromEmail} />
            <KV label="Template" value={template?.name || "Custom HTML"} />
          </ReviewSection>

          <ReviewSection title="Audience summary">
            <KV label="Lists" value={selectedLists.map((l) => l.name).join(", ") || "—"} />
            {excludedLists.length > 0 && <KV label="Excluded" value={excludedLists.map((l) => l.name).join(", ")} />}
            <KV label="Total contacts" value={fmt.format(totalContacts)} />
            <KV label="Suppressed (est.)" value={fmt.format(suppressedEst)} />
            <KV label="Unsubscribed (est.)" value={fmt.format(unsubEst)} />
            <KV label="Deliverable" value={fmt.format(deliverableEst)} highlight />
          </ReviewSection>

          <ReviewSection title="AWS SES">
            <KV label="Region" value={ses.region} mono />
            <KV label="Sending identity" value={ses.defaultFromEmail} mono />
            <KV label="Configuration set" value={ses.configurationSet} mono />
          </ReviewSection>

          <ReviewSection title="AWS SNS">
            <KV label="Topic ARN" value={ses.snsTopicArn} mono />
            <KV label="Webhook endpoint" value={ses.snsWebhookUrl} mono />
            <KV label="Tracking enabled" value={enabledTracks.join(", ") || "None"} />
          </ReviewSection>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Ready to send?</CardTitle>
            <CardDescription>{issues.length === 0 ? "All checks passed." : `${issues.length} item${issues.length === 1 ? "" : "s"} to review.`}</CardDescription>
          </CardHeader>
          <CardContent>
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Pre-flight clean. Continue to the Send step.</span>
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {issues.map((c) => (
                  <li key={c.label} className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{c.label}{c.hint && <span className="text-muted-foreground"> · {c.hint}</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============= STEP 6 =============

function StepSend(props: {
  name: string;
  deliverableEst: number;
  estSendSeconds: number;
  ses: SesInfo;
  scheduleAt: string; setScheduleAt: (v: string) => void;
  canLaunch: boolean;
  onLaunch: () => void;
  onSaveDraft: () => void;
  onSendTest: () => void;
  saving: boolean;
}) {
  const { name, deliverableEst, estSendSeconds, ses, scheduleAt, setScheduleAt,
    canLaunch, onLaunch, onSaveDraft, onSendTest, saving } = props;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Launch "{name || "campaign"}"</CardTitle>
          <CardDescription>Send through AWS SES now, or schedule for later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <BigStat label="Recipients" value={fmt.format(deliverableEst)} icon={Users} />
            <BigStat label="Est. send time" value={formatDuration(estSendSeconds)} icon={Clock} />
            <BigStat label="SES region" value={ses.region || "—"} icon={CloudCog} />
            <BigStat label="Config set" value={ses.configurationSet || "—"} icon={Shield} />
          </div>

          <div className="grid gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" /> Schedule (optional)
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="sm:max-w-xs"
              />
              {scheduleAt && (
                <Button variant="ghost" size="sm" onClick={() => setScheduleAt("")}>Clear</Button>
              )}
              <span className="text-xs text-muted-foreground">
                {scheduleAt ? `Will send at ${new Date(scheduleAt).toLocaleString()}` : "Leave empty to send immediately on launch."}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onLaunch} disabled={!canLaunch} size="lg">
              <Send className="mr-2 h-4 w-4" />{scheduleAt ? "Schedule Campaign" : "Send Campaign"}
            </Button>
            <Button variant="outline" onClick={onSendTest}>
              <FlaskConical className="mr-2 h-4 w-4" />Send Test Email
            </Button>
            <Button variant="ghost" onClick={onSaveDraft} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />Save Draft
            </Button>
          </div>
          {!canLaunch && (
            <p className="text-xs text-amber-500">
              Resolve the issues flagged in the Tracking step before launching.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What happens next</CardTitle>
          <CardDescription>How SES + SNS handle the send.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <Timeline items={[
            { label: "Queue", desc: "Recipients are written to email_queue." },
            { label: "Send", desc: "Worker pulls batches and calls SES SendEmail." },
            { label: "Track", desc: "SES delivers events to SNS topic." },
            { label: "Ingest", desc: "Webhook updates campaign_events + queue." },
            { label: "Suppress", desc: "Bounces and complaints update suppression lists." },
          ]} />
        </CardContent>
      </Card>
    </div>
  );
}

// ============= helpers =============

function TrackRow({ icon: Icon, label, hint, checked, onChange }: {
  icon: typeof Eye; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function KV({ label, value, mono, highlight }: { label: string; value?: string | null; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        "text-right text-sm",
        mono && "font-mono text-xs",
        highlight && "font-bold text-primary",
        !value && "text-muted-foreground italic",
      )}>{value || "—"}</span>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="rounded-lg border bg-muted/20 p-3">{children}</div>
    </div>
  );
}

function ReachRow({ label, value, tone }: { label: string; value: number; tone: "muted" | "warning" | "destructive" }) {
  const color = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-amber-500" : "text-foreground";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", color)}>
        {value > 0 ? "+" : ""}{fmt.format(value)}
      </span>
    </div>
  );
}

function BigStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 truncate text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function SesPill({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate pl-2 font-mono">{value || "—"}</span>
    </div>
  );
}

function EmptyState({ title, description, cta }: { title: string; description: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      {cta && <div className="mt-3 text-sm">{cta}</div>}
    </div>
  );
}

function Meter({ value, min, max }: { value: number; min: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const ok = value >= min && value <= max;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full transition-all", ok ? "bg-emerald-500" : value > max ? "bg-destructive" : "bg-amber-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Timeline({ items }: { items: { label: string; desc: string }[] }) {
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[26px] grid h-5 w-5 place-items-center rounded-full border bg-background text-[10px] font-semibold">
            {i + 1}
          </span>
          <div className="text-sm font-medium">{it.label}</div>
          <div className="text-xs text-muted-foreground">{it.desc}</div>
        </li>
      ))}
    </ol>
  );
}

function bounded(n: number, min: number, max: number): { label: string; tone: string } {
  if (n === 0) return { label: "empty", tone: "text-muted-foreground" };
  if (n < min) return { label: "too short", tone: "text-amber-500" };
  if (n > max) return { label: "too long", tone: "text-destructive" };
  return { label: "looks good", tone: "text-emerald-500" };
}

function wrapDark(html: string) {
  return `<style>html,body{background:#0b0b0c;color:#e5e7eb;}a{color:#93c5fd;}</style>${html}`;
}

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

function formatDuration(seconds: number) {
  if (!seconds || seconds < 1) return "—";
  if (seconds < 60) return `~${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60); const mm = m % 60;
  return `~${h}h ${mm}m`;
}
