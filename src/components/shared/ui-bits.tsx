import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, TrendingDown, TrendingUp, FlaskConical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RecStatus, RiskLevel } from "@/types";

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground md:text-[1.7rem]">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, sub, right, children, className }: { title?: string; sub?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("surface p-5", className)}>
      {(title || right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function SimTag({ children = "Simulated" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal/50 bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
      <FlaskConical className="h-3 w-3" />
      {children}
    </span>
  );
}

export function KpiCard({ label, value, icon: Icon, trend, trendGood, hint, tone = "default" }: {
  label: string; value: string; icon: LucideIcon; trend?: string; trendGood?: boolean; hint: string; tone?: "default" | "warn" | "risk";
}) {
  const toneCls = tone === "risk" ? "bg-risk-high-soft text-risk-high" : tone === "warn" ? "bg-risk-med-soft text-risk-med" : "bg-primary-soft text-primary";
  return (
    <div className="surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", toneCls)}><Icon className="h-4 w-4" /></span>
        <Tooltip>
          <TooltipTrigger aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></TooltipTrigger>
          <TooltipContent className="max-w-60">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-3 text-xs font-medium text-muted-foreground">{label}</div>
      <div className="num mt-1 text-xl font-semibold text-foreground">{value}</div>
      {trend && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs", trendGood ? "text-risk-low" : "text-risk-med")}>
          {trendGood ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />} {trend}
        </div>
      )}
    </div>
  );
}

const RISK_CLS: Record<RiskLevel, string> = {
  low: "bg-risk-low-soft text-risk-low",
  medium: "bg-risk-med-soft text-risk-med",
  high: "bg-risk-high-soft text-risk-high",
};
export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium capitalize", RISK_CLS[level])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {level}{score !== undefined && <span className="num opacity-80">· {score}</span>}
    </span>
  );
}

const STATUS_CLS: Record<RecStatus, string> = {
  pending: "bg-risk-med-soft text-risk-med",
  approved: "bg-risk-low-soft text-risk-low",
  rejected: "bg-muted text-muted-foreground line-through",
  edited: "bg-accent text-accent-foreground",
};
export function StatusBadge({ status }: { status: RecStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_CLS[status])}>{status}</span>;
}

export function Empty({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed p-10 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {desc && <div className="mt-1 text-xs text-muted-foreground">{desc}</div>}
    </div>
  );
}

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
export const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 };
