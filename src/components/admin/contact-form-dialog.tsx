import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Contact, ContactInput, ListRow } from "@/lib/contactsApi";
import { createContact, updateContact } from "@/lib/contactsApi";

const STATUSES = ["subscribed", "unsubscribed", "bounced", "complained"] as const;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact?: Contact | null;
  lists: ListRow[];
  onSaved: () => void;
};

export function ContactFormDialog({ open, onOpenChange, contact, lists, onSaved }: Props) {
  const [form, setForm] = useState<ContactInput>({ email: "" });
  const [listIds, setListIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        email: contact?.email || "",
        first_name: contact?.first_name || "",
        last_name: contact?.last_name || "",
        phone: contact?.phone || "",
        company: contact?.company || "",
        job_title: contact?.job_title || "",
        award_category: contact?.award_category || "",
        status: (contact?.status as ContactInput["status"]) || "subscribed",
        source: contact?.source || "",
        notes: contact?.notes || "",
      });
      setListIds(contact?.lists.map((l) => l.id) || []);
    }
  }, [open, contact]);

  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.email.trim()) return toast.error("Email is required");
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(form.email.trim())) return toast.error("Invalid email address");
    setSaving(true);
    try {
      const payload = { ...form, email: form.email.trim(), list_ids: listIds };
      if (contact) await updateContact(contact.id, payload);
      else await createContact(payload);
      toast.success(contact ? "Contact updated" : "Contact created");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Contact" : "New Contact"}</DialogTitle>
          <DialogDescription>
            All contact data is saved to the PostgreSQL database.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>First name</Label>
            <Input value={form.first_name || ""} onChange={(e) => set("first_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Last name</Label>
            <Input value={form.last_name || ""} onChange={(e) => set("last_name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Company</Label>
            <Input value={form.company || ""} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Job title</Label>
            <Input value={form.job_title || ""} onChange={(e) => set("job_title", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Award category</Label>
            <Input
              placeholder="e.g. AfriSAFE Mentor of the Year Award"
              value={form.award_category || ""}
              onChange={(e) => set("award_category", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Source</Label>
            <Input placeholder="signup, csv, manual…" value={form.source || ""}
              onChange={(e) => set("source", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.status || "subscribed"} onValueChange={(v) => set("status", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Lists</Label>
            {lists.length === 0 ? (
              <div className="text-xs text-muted-foreground">No lists yet. Create one first.</div>
            ) : (
              <div className="grid max-h-40 gap-2 overflow-auto rounded-md border p-3 sm:grid-cols-2">
                {lists.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={listIds.includes(l.id)}
                      onCheckedChange={(v) =>
                        setListIds((prev) => (v ? [...prev, l.id] : prev.filter((x) => x !== l.id)))
                      }
                    />
                    {l.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
