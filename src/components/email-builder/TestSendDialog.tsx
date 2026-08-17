import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { sendTestTemplate } from "@/lib/templatesApi";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateId: string | null;
};

export function TestSendDialog({ open, onOpenChange, templateId }: Props) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!templateId) { toast.error("Save the template before sending a test."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    try {
      await sendTestTemplate(templateId, to);
      toast.success(`Test email sent to ${to}`);
      onOpenChange(false);
      setTo("");
    } catch (e: any) {
      toast.error(e?.message || "Send failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send test email</DialogTitle>
          <DialogDescription>
            Sends a single email through SES with sample merge tag values. Subject is prefixed with <code>[TEST]</code>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Recipient</Label>
          <Input type="email" placeholder="you@company.com" value={to} onChange={(e) => setTo(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={send} disabled={busy || !templateId}>{busy ? "Sending…" : "Send test"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
