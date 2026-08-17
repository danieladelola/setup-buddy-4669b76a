import { useMemo, useRef, useState } from "react";
import { Upload, FileText, ClipboardPaste, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { parseContacts, type ParseResult } from "@/lib/parseContacts";
import { importIntoList } from "@/lib/contactsApi";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string | null;
  listName: string;
  onImported?: () => void;
};

export function ImportContactsDialog({ open, onOpenChange, listId, listName, onImported }: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast.error("File too large (max 25 MB)");
    const content = await f.text();
    setText(content);
    setParsed(parseContacts(content));
  };

  const reparse = (v: string) => {
    setText(v);
    setParsed(v.trim() ? parseContacts(v) : null);
  };

  const doImport = async () => {
    if (!listId || !parsed?.valid.length) return;
    setBusy(true);
    const rows = parsed.valid;
    const CHUNK = 250;
    const totals = { inserted: 0, updated: 0, invalid: 0, duplicates: 0, linked: 0, total: 0 };
    setProgress({ done: 0, total: rows.length });
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const res = await importIntoList(listId, chunk);
        totals.inserted += res.inserted;
        totals.updated += res.updated;
        totals.invalid += res.invalid;
        totals.duplicates += res.duplicates;
        totals.linked += res.linked;
        totals.total += res.total;
        setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
      }
      toast.success(
        `Imported ${totals.linked} into "${listName}" — ${totals.inserted} new, ${totals.updated} updated, ${totals.invalid} invalid`
      );
      onImported?.();
      onOpenChange(false);
      setText(""); setParsed(null);
    } catch (e: any) {
      toast.error(
        `Import failed after ${totals.linked}/${rows.length}: ${e?.message || "unknown error"}`
      );
    } finally { setBusy(false); setProgress(null); }
  };

  const close = () => { if (busy) return; onOpenChange(false); setText(""); setParsed(null); };

  const preview = useMemo(() => parsed?.valid.slice(0, 5) || [], [parsed]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import contacts → {listName}</DialogTitle>
          <DialogDescription>
            Upload a CSV/TSV file or paste rows. We auto-detect <code>;</code>, <code>,</code> or tab delimiters.
            Recognized columns: EMAIL, FIRSTNAME, LASTNAME, SMS / LANDLINE_NUMBER / PHONE, JOB_TITLE, COMPANY.
            Bad or duplicate emails are dropped automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="paste">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="paste"><ClipboardPaste className="mr-2 h-4 w-4" />Paste</TabsTrigger>
            <TabsTrigger value="file"><Upload className="mr-2 h-4 w-4" />Upload file</TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="pt-3">
            <Label className="text-xs text-muted-foreground">
              Paste CSV including header row, or one email per line.
            </Label>
            <Textarea
              rows={10}
              className="mt-1 font-mono text-xs"
              placeholder={`EMAIL;FIRSTNAME;LASTNAME;SMS\njane@acme.com;Jane;Doe;+1...`}
              value={text}
              onChange={(e) => reparse(e.target.value)}
            />
          </TabsContent>

          <TabsContent value="file" className="pt-3">
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-8 text-sm text-muted-foreground">
              <FileText className="mb-2 h-6 w-6" />
              <p>CSV or TSV, up to 25 MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {parsed && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" /> {parsed.valid.length} valid
              </span>
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-4 w-4" /> {parsed.invalid.length} invalid
              </span>
              <span className="text-muted-foreground">{parsed.duplicates} duplicates</span>
              {parsed.headers.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Delimiter: <code>{parsed.delimiter === "\t" ? "TAB" : parsed.delimiter}</code> · {parsed.headers.length} columns
                </span>
              )}
            </div>

            {preview.length > 0 && (
              <div className="overflow-hidden rounded border bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-2 py-1 text-left">Email</th>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((c, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{c.email}</td>
                        <td className="px-2 py-1 text-muted-foreground">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                        <td className="px-2 py-1 text-muted-foreground">{c.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.valid.length > preview.length && (
                  <div className="border-t px-2 py-1 text-xs text-muted-foreground">
                    + {parsed.valid.length - preview.length} more…
                  </div>
                )}
              </div>
            )}

            {parsed.invalid.length > 0 && parsed.invalid.length <= 5 && (
              <div className="text-xs text-muted-foreground">
                Skipped: {parsed.invalid.map((i) => `line ${i.line} (${i.reason})`).join(", ")}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancel</Button>
          <Button onClick={doImport} disabled={busy || !parsed?.valid.length}>
            {busy
              ? progress
                ? `Importing ${progress.done}/${progress.total}…`
                : "Importing…"
              : `Import ${parsed?.valid.length || 0} contacts`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
