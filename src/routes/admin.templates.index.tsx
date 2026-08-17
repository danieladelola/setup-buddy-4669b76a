import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Pencil, Copy, Eye, Trash2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/admin/page-header";
import {
  listTemplates, deleteTemplate, duplicateTemplate, getTemplate, type Template,
} from "@/lib/templatesApi";

export const Route = createFileRoute("/admin/templates/")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listTemplates());
    } catch (e: any) {
      toast.error(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const openPreview = async (t: Template) => {
    try {
      setPreviewing(await getTemplate(t.id));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load template");
    }
  };

  const onDuplicate = async (t: Template) => {
    try {
      const copy = await duplicateTemplate(t.id);
      toast.success("Template duplicated");
      refresh();
      navigate({ to: "/admin/templates/builder/$id", params: { id: copy.id } });
    } catch (e: any) {
      toast.error(e?.message || "Duplicate failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTemplate(deleting.id);
      toast.success("Template deleted");
      setDeleting(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  };

  const filtered = items.filter((t) =>
    !q.trim() ||
    t.name.toLowerCase().includes(q.toLowerCase()) ||
    (t.subject || "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Email Templates"
        description="Reusable, brand-consistent designs for every campaign."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button onClick={() => navigate({ to: "/admin/templates/builder/$id", params: { id: "new" } })}>
              <Plus className="mr-2 h-4 w-4" />Create Template
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
          No templates yet. Click <span className="font-medium text-foreground">Create Template</span> to build one with the drag-and-drop editor.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="overflow-hidden transition hover:border-primary/40">
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-primary/15 via-brand-glow/10 to-background relative">
                <div className="absolute inset-6 rounded-md bg-card/60 backdrop-blur-sm flex flex-col gap-2 p-4">
                  <div className="h-2 w-1/2 rounded bg-foreground/30" />
                  <div className="h-1.5 w-3/4 rounded bg-foreground/15" />
                  <div className="h-1.5 w-2/3 rounded bg-foreground/15" />
                  <div className="mt-auto h-6 w-20 rounded bg-primary/60" />
                </div>
                {t.status && t.status !== "draft" && (
                  <Badge className="absolute right-3 top-3 capitalize">{t.status}</Badge>
                )}
                {t.status === "draft" && (
                  <Badge variant="secondary" className="absolute right-3 top-3">Draft</Badge>
                )}
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <p className="truncate text-xs text-muted-foreground">{t.subject || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {new Date(t.updated_at).toLocaleDateString()}
                </p>
              </CardHeader>
              <CardFooter className="flex flex-wrap gap-1.5 pt-0">
                <Button size="sm" variant="ghost" onClick={() => openPreview(t)}>
                  <Eye className="mr-1 h-3.5 w-3.5" />Preview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/admin/templates/builder/$id", params: { id: t.id } })}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDuplicate(t)}>
                  <Copy className="mr-1 h-3.5 w-3.5" />Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewing?.name}</DialogTitle>
            <DialogDescription>{previewing?.subject}</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-white">
            <iframe
              title="template-preview"
              srcDoc={previewing?.html_body || ""}
              className="h-[500px] w-full rounded-lg"
              sandbox=""
            />
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" will be permanently removed. Campaigns already sent are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
