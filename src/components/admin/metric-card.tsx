import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  trend,
  intent = "default",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: LucideIcon;
  trend?: { value: number; direction: "up" | "down" };
  intent?: "default" | "positive" | "warning" | "danger";
}) {
  const intentRing = {
    default: "ring-border",
    positive: "ring-emerald-500/30",
    warning: "ring-amber-500/30",
    danger: "ring-destructive/30",
  }[intent];

  return (
    <div className={cn("rounded-xl border bg-card p-5 ring-1 ring-inset", intentRing)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trend.direction === "up" ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <span
            className={cn(
              trend.direction === "up" ? "text-emerald-400" : "text-destructive",
            )}
          >
            {trend.value}%
          </span>
          <span className="text-muted-foreground">vs last week</span>
        </div>
      )}
    </div>
  );
}
