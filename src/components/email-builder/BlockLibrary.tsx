import { useDraggable } from "@dnd-kit/core";
import { BLOCKS, type BlockMeta } from "@/lib/email-builder/blocks";
import { cn } from "@/lib/utils";

type Props = { className?: string };

function DraggableBlock({ meta }: { meta: BlockMeta }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib-${meta.type}`,
    data: { source: "library", blockType: meta.type },
  });
  const Icon = meta.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...listeners}
      {...attributes}
      className={cn(
        "group flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-3 text-xs",
        "hover:border-primary/60 hover:bg-accent/40 hover:shadow-sm transition cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      title={`Drag to insert: ${meta.label}`}
    >
      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      <span className="text-[11px] font-medium leading-none">{meta.label}</span>
    </button>
  );
}

export function BlockLibrary({ className }: Props) {
  const groups: Array<{ key: BlockMeta["group"]; title: string }> = [
    { key: "content", title: "Content" },
    { key: "layout",  title: "Layout"  },
    { key: "section", title: "Sections" },
  ];
  return (
    <aside className={cn("flex h-full flex-col overflow-hidden border-r bg-card/40", className)}>
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Blocks</h3>
        <p className="text-xs text-muted-foreground">Drag onto the canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.title}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BLOCKS.filter((b) => b.group === g.key).map((m) => (
                <DraggableBlock key={m.type} meta={m} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
