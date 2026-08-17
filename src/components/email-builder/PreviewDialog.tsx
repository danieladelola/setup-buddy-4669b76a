import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Monitor, Smartphone, Mail, Maximize2 } from "lucide-react";
import type { BuilderDoc } from "@/lib/email-builder/types";
import { renderEmailHtml } from "@/lib/email-builder/render";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: BuilderDoc;
  meta: { name: string; subject: string; previewText: string; fromName: string };
};

export function PreviewDialog({ open, onOpenChange, doc, meta }: Props) {
  const [mode, setMode] = useState<"desktop" | "mobile" | "inbox">("desktop");
  const [dark, setDark] = useState(false);
  const [full, setFull] = useState(false);
  const html = useMemo(
    () => renderEmailHtml(doc, { preheader: meta.previewText, subject: meta.subject }),
    [doc, meta.previewText, meta.subject]
  );
  const width = mode === "mobile" ? 380 : 700;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={full ? "max-w-[98vw] h-[95vh]" : "max-w-4xl"}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Preview · {meta.name || "Untitled"}</span>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as any)} size="sm">
                <ToggleGroupItem value="desktop" aria-label="Desktop"><Monitor className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="mobile" aria-label="Mobile"><Smartphone className="h-3.5 w-3.5" /></ToggleGroupItem>
                <ToggleGroupItem value="inbox" aria-label="Inbox"><Mail className="h-3.5 w-3.5" /></ToggleGroupItem>
              </ToggleGroup>
              <Button size="sm" variant={dark ? "default" : "outline"} onClick={() => setDark((d) => !d)}>Dark</Button>
              <Button size="sm" variant="ghost" onClick={() => setFull((f) => !f)}><Maximize2 className="h-3.5 w-3.5" /></Button>
            </div>
          </DialogTitle>
          <DialogDescription>Subject: {meta.subject || "—"}</DialogDescription>
        </DialogHeader>

        {mode === "inbox" && (
          <div className={`rounded-lg border ${dark ? "bg-slate-900 text-slate-100" : "bg-white"}`}>
            <div className={`flex items-center gap-3 border-b px-4 py-3 ${dark ? "border-slate-700" : ""}`}>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                {(meta.fromName || "H").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{meta.fromName || "HSENations"}</div>
                  <div className="text-xs text-muted-foreground">now</div>
                </div>
                <div className="truncate text-sm">{meta.subject || "(no subject)"}</div>
                <div className="truncate text-xs text-muted-foreground">{meta.previewText || "(no preview text)"}</div>
              </div>
            </div>
          </div>
        )}

        <div className={`mx-auto overflow-auto rounded-lg border ${dark ? "bg-slate-900" : "bg-muted/40"}`} style={{ height: full ? "75vh" : 520 }}>
          <iframe
            title="preview"
            srcDoc={html}
            className="mx-auto block bg-white"
            style={{ width, height: "100%", border: 0, colorScheme: dark ? "dark" : "light" }}
            sandbox=""
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
