import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Block, BuilderDoc } from "@/lib/email-builder/types";
import { renderEmailHtml } from "@/lib/email-builder/render";
import { Button } from "@/components/ui/button";

type Props = {
  doc: BuilderDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  viewport: "desktop" | "mobile";
};

function SortableBlockShell({
  block, selected, onSelect, onDelete, onDuplicate, onMove,
}: {
  block: Block; selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    data: { source: "canvas", blockId: block.id },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  } as React.CSSProperties;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        selected ? "outline outline-2 outline-primary outline-offset-[-2px]" : "outline-2 outline-transparent hover:outline hover:outline-primary/40 outline-offset-[-2px]",
      )}
      onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
    >
      {/* Hover/selected toolbar */}
      <div className={cn(
        "absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-md border bg-background px-1 py-0.5 shadow-sm",
        selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-accent" title="Move up"
          onClick={(e) => { e.stopPropagation(); onMove(block.id, -1); }}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-accent" title="Move down"
          onClick={(e) => { e.stopPropagation(); onMove(block.id, 1); }}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-accent" title="Duplicate"
          onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}>
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-destructive hover:bg-destructive/10" title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Block-only HTML preview */}
      <BlockRender block={block} />
    </div>
  );
}

function BlockRender({ block }: { block: Block }) {
  // Render a single block in an isolated iframe so its email-safe CSS does not
  // bleed into the app shell.
  const html = useMemo(() => {
    const doc: BuilderDoc = {
      version: 1,
      settings: {
        contentWidth: 600,
        backgroundColor: "transparent",
        contentBackground: "transparent",
        fontFamily: "Arial, Helvetica, sans-serif",
        textColor: "#111827",
        linkColor: "#2563eb",
      },
      blocks: [block],
    };
    return renderEmailHtml(doc);
  }, [block]);

  return (
    <div className="bg-white">
      <iframe
        title={`block-${block.id}`}
        srcDoc={html}
        className="block w-full"
        style={{ height: heightFor(block), border: 0 }}
        sandbox=""
      />
    </div>
  );
}

function heightFor(b: Block): number {
  switch (b.type) {
    case "spacer": return (b.props.height ?? 24) + 16;
    case "divider": return 50;
    case "hero": return 320;
    case "card": return 200;
    case "event": return 220;
    case "social": return 90;
    case "footer": return 110;
    case "unsubscribe": return 80;
    case "image":
    case "logo": return 220;
    case "columns": return 220;
    case "button": return 100;
    case "heading": return 90;
    default: return 110;
  }
}

export function Canvas({ doc, selectedId, onSelect, onDelete, onDuplicate, onMove, viewport }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-root" });
  const ids = doc.blocks.map((b) => b.id);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/30">
      <div className="flex-1 overflow-y-auto p-6" onClick={() => onSelect(null)}>
        <div
          className={cn(
            "mx-auto rounded-lg border bg-white shadow-sm transition-all",
            isOver && "ring-2 ring-primary/40",
          )}
          style={{
            width: viewport === "mobile" ? 380 : doc.settings.contentWidth,
            maxWidth: "100%",
            background: doc.settings.contentBackground,
          }}
          ref={setNodeRef}
          onClick={(e) => e.stopPropagation()}
        >
          {doc.blocks.length === 0 ? (
            <EmptyCanvas />
          ) : (
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div>
                {doc.blocks.map((b) => (
                  <SortableBlockShell
                    key={b.id}
                    block={b}
                    selected={b.id === selectedId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onMove={onMove}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-sm text-muted-foreground">
      <div className="rounded-full bg-muted p-3">📥</div>
      <div className="font-medium text-foreground">Start with a block</div>
      <div>Drag a block from the left panel to begin building your email.</div>
    </div>
  );
}

// Re-export so EmailBuilder can sort canvas blocks itself when needed.
export const sortBlocks = (blocks: Block[], fromId: string, toId: string) => {
  const from = blocks.findIndex((b) => b.id === fromId);
  const to = blocks.findIndex((b) => b.id === toId);
  if (from < 0 || to < 0) return blocks;
  return arrayMove(blocks, from, to);
};

// Lightweight no-op hook export to keep the component file self-contained.
export const _ = useState;
