import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ArrowLeft, Eye, Save, Redo2, Send, Undo2, Monitor, Smartphone, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { BlockLibrary } from "./BlockLibrary";
import { Canvas } from "./Canvas";
import { SettingsPanel } from "./SettingsPanel";
import { PreviewDialog } from "./PreviewDialog";
import { TestSendDialog } from "./TestSendDialog";

import { useHistory } from "@/lib/email-builder/useHistory";
import { defaultBlock, emptyDoc, newId } from "@/lib/email-builder/defaults";
import { hasUnsubscribe, renderEmailHtml, renderPlainText } from "@/lib/email-builder/render";
import type { Block, BuilderDoc, BlockType, EmailSettings } from "@/lib/email-builder/types";
import { createTemplate, updateTemplate, type Template } from "@/lib/templatesApi";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type Meta = {
  id: string | null;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  status: "draft" | "active" | "archived";
};

export function EmailBuilder({ initial }: { initial: Template | null }) {
  const navigate = useNavigate();

  const [meta, setMeta] = useState<Meta>({
    id: initial?.id || null,
    name: initial?.name || "Untitled template",
    subject: initial?.subject || "",
    previewText: initial?.preview_text || "",
    fromName: initial?.from_name || "",
    status: (initial?.status as Meta["status"]) || "draft",
  });

  const history = useHistory<BuilderDoc>(initial?.builder_json || emptyDoc());
  const doc = history.state;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [activeDrag, setActiveDrag] = useState<{ from: "library" | "canvas"; type?: BlockType; id?: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // ---- Doc mutations -------------------------------------------------------
  const updateBlock = useCallback((id: string, patch: any, recordHistory = true) => {
    history.set((d) => ({
      ...d,
      blocks: d.blocks.map((b) => b.id === id ? { ...b, props: { ...b.props, ...patch } } : b),
    }), { history: recordHistory });
    setSaveStatus("dirty");
  }, [history]);

  const updateSettings = useCallback((patch: Partial<EmailSettings>) => {
    history.set((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    setSaveStatus("dirty");
  }, [history]);

  const deleteBlock = useCallback((id: string) => {
    history.set((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    setSaveStatus("dirty");
  }, [history, selectedId]);

  const duplicateBlock = useCallback((id: string) => {
    history.set((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return d;
      const orig = d.blocks[idx];
      const clone: Block = JSON.parse(JSON.stringify(orig));
      clone.id = newId();
      const next = [...d.blocks];
      next.splice(idx + 1, 0, clone);
      return { ...d, blocks: next };
    });
    setSaveStatus("dirty");
  }, [history]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    history.set((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= d.blocks.length) return d;
      return { ...d, blocks: arrayMove(d.blocks, idx, target) };
    });
    setSaveStatus("dirty");
  }, [history]);

  // ---- Drag-and-drop -------------------------------------------------------
  const onDragStart = (e: DragStartEvent) => {
    const data: any = e.active.data.current;
    if (data?.source === "library") setActiveDrag({ from: "library", type: data.blockType });
    else if (data?.source === "canvas") setActiveDrag({ from: "canvas", id: data.blockId });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const a: any = e.active.data.current;
    const o: any = e.over?.data.current;
    setActiveDrag(null);
    if (!e.over) return;

    if (a?.source === "library") {
      const t = a.blockType as BlockType;
      const newBlock = defaultBlock(t);
      history.set((d) => {
        // If dropped over an existing block, insert just after it.
        if (o?.source === "canvas") {
          const idx = d.blocks.findIndex((b) => b.id === o.blockId);
          if (idx >= 0) {
            const next = [...d.blocks];
            next.splice(idx + 1, 0, newBlock);
            return { ...d, blocks: next };
          }
        }
        return { ...d, blocks: [...d.blocks, newBlock] };
      });
      setSelectedId(newBlock.id);
      setSaveStatus("dirty");
      return;
    }

    if (a?.source === "canvas" && e.over.id !== e.active.id) {
      const overId = String(e.over.id);
      history.set((d) => {
        const from = d.blocks.findIndex((b) => b.id === e.active.id);
        const to = d.blocks.findIndex((b) => b.id === overId);
        if (from < 0 || to < 0) return d;
        return { ...d, blocks: arrayMove(d.blocks, from, to) };
      });
      setSaveStatus("dirty");
    }
  };

  // ---- Save / autosave -----------------------------------------------------
  const html = useMemo(() => renderEmailHtml(doc, { preheader: meta.previewText, subject: meta.subject }), [doc, meta.previewText, meta.subject]);
  const text = useMemo(() => renderPlainText(doc), [doc]);

  const buildPayload = () => ({
    name: meta.name.trim() || "Untitled template",
    subject: meta.subject.trim() || meta.name.trim() || "Untitled",
    preview_text: meta.previewText,
    from_name: meta.fromName || null,
    status: meta.status,
    html_body: html,
    text_body: text,
    builder_json: doc,
  });

  const performSave = useCallback(async (opts?: { silent?: boolean }) => {
    setSaveStatus("saving");
    try {
      const payload = buildPayload();
      if (meta.id) {
        await updateTemplate(meta.id, payload);
      } else {
        const created = await createTemplate(payload);
        setMeta((m) => ({ ...m, id: created.id }));
        // Update URL so reloads keep editing the same template.
        navigate({ to: "/admin/templates/builder/$id", params: { id: created.id }, replace: true });
      }
      setSaveStatus("saved");
      if (!opts?.silent) toast.success("Template saved");
    } catch (e: any) {
      setSaveStatus("error");
      toast.error(e?.message || "Save failed");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, doc, html, text]);

  // Debounced autosave whenever doc/meta change & state is dirty.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveStatus !== "dirty") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { performSave({ silent: true }); }, 1500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [doc, meta, saveStatus, performSave]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty" || saveStatus === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  // Mark dirty whenever meta changes after initial mount.
  const firstMeta = useRef(true);
  useEffect(() => {
    if (firstMeta.current) { firstMeta.current = false; return; }
    setSaveStatus("dirty");
  }, [meta.name, meta.subject, meta.previewText, meta.fromName, meta.status]);

  // ---- Validation ----------------------------------------------------------
  const validate = (): string | null => {
    if (!meta.name.trim()) return "Template name is required";
    if (!meta.subject.trim()) return "Subject is required";
    if (!doc.blocks.length) return "Add at least one content block";
    for (const b of doc.blocks) {
      if ((b.type === "image" || b.type === "logo") && !b.props.alt?.trim()) return `Image block is missing alt text`;
      if (b.type === "button" && !/^https?:\/\//i.test(b.props.href || "")) return `Button "${b.props.text}" needs a valid URL`;
    }
    if (!hasUnsubscribe(doc)) return "Add an Unsubscribe block (required by spam laws)";
    return null;
  };

  const onSaveClick = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    await performSave();
  };

  const onTestClick = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!meta.id) { toast.message("Saving first…"); performSave({ silent: true }).then(() => setTestOpen(true)); return; }
    setTestOpen(true);
  };

  const selected = doc.blocks.find((b) => b.id === selectedId) || null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="fixed inset-0 z-40 flex flex-col bg-background">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/admin/templates" })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Exit
          </Button>
          <div className="mx-2 h-6 w-px bg-border" />
          <Input
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className="h-8 max-w-[280px] border-transparent text-sm font-semibold focus-visible:border-input"
            placeholder="Untitled template"
          />
          <SaveStatusPill status={saveStatus} />

          <div className="ml-auto flex items-center gap-2">
            <ToggleGroup type="single" value={viewport} onValueChange={(v) => v && setViewport(v as any)} size="sm">
              <ToggleGroupItem value="desktop" aria-label="Desktop"><Monitor className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Mobile"><Smartphone className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
            <Button variant="ghost" size="icon" disabled={!history.canUndo} onClick={history.undo} title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" disabled={!history.canRedo} onClick={history.redo} title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="mr-1 h-4 w-4" />Preview</Button>
            <Button variant="outline" size="sm" onClick={onTestClick}><Send className="mr-1 h-4 w-4" />Send test</Button>
            <Button size="sm" onClick={onSaveClick}><Save className="mr-1 h-4 w-4" />Save</Button>
          </div>
        </header>

        {/* Subject/preview text strip */}
        <div className="flex shrink-0 items-center gap-2 border-b bg-card/60 px-3 py-2">
          <Input
            value={meta.subject}
            onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
            placeholder="Subject line — what recipients see in their inbox"
            className="h-8 flex-1 text-sm"
          />
          <Input
            value={meta.previewText}
            onChange={(e) => setMeta({ ...meta, previewText: e.target.value })}
            placeholder="Preview text (preheader)"
            className="h-8 flex-1 text-sm"
          />
          <Input
            value={meta.fromName}
            onChange={(e) => setMeta({ ...meta, fromName: e.target.value })}
            placeholder="From name (override)"
            className="h-8 w-56 text-sm"
          />
        </div>

        {/* 3-panel layout */}
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px]">
          <BlockLibrary />
          <Canvas
            doc={doc}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={deleteBlock}
            onDuplicate={duplicateBlock}
            onMove={moveBlock}
            viewport={viewport}
          />
          <SettingsPanel doc={doc} selected={selected} onUpdateBlock={updateBlock} onUpdateSettings={updateSettings} />
        </div>
      </div>

      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        doc={doc}
        meta={{ name: meta.name, subject: meta.subject, previewText: meta.previewText, fromName: meta.fromName }}
      />
      <TestSendDialog open={testOpen} onOpenChange={setTestOpen} templateId={meta.id} />

      <DragOverlay>
        {activeDrag?.from === "library" && activeDrag.type ? (
          <div className="rounded-md border bg-card px-3 py-2 text-xs font-medium shadow-md">
            + Add {activeDrag.type}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SaveStatusPill({ status }: { status: SaveStatus }) {
  const map: Record<SaveStatus, { icon: any; label: string; cls: string }> = {
    idle:    { icon: CheckCircle2, label: "All changes saved", cls: "text-muted-foreground" },
    dirty:   { icon: AlertCircle,  label: "Unsaved changes",   cls: "text-amber-600" },
    saving:  { icon: Loader2,      label: "Saving…",           cls: "text-muted-foreground animate-pulse" },
    saved:   { icon: CheckCircle2, label: "Saved",             cls: "text-emerald-600" },
    error:   { icon: AlertCircle,  label: "Save failed",       cls: "text-destructive" },
  };
  const { icon: Icon, label, cls } = map[status];
  return (
    <span className={`ml-2 inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "saving" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}
