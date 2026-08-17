import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground border-transparent",
  Scheduled: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Sending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Failed: "bg-destructive/15 text-destructive border-destructive/30",
  Paused: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  pending: "bg-muted text-muted-foreground border-transparent",
  sending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  Subscribed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Unsubscribed: "bg-muted text-muted-foreground border-transparent",
  Bounced: "bg-destructive/15 text-destructive border-destructive/30",
  healthy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  standby: "bg-muted text-muted-foreground border-transparent",
  subscribed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium capitalize", map[status] ?? "")}>
      {status}
    </Badge>
  );
}
