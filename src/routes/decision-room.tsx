import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Ban, Bot, Check, CheckCircle2, CircleDot, Gauge, HeartHandshake, Pencil, Percent, RefreshCcw, Snowflake, TrendingUp, Truck, X, XCircle, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Empty, PageHeader, Panel, SimTag, StatusBadge } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PARTNERS } from "@/data/seed";
import { ACTION_LABEL, fmt, inr, product, storeName } from "@/services/logic";
import { cn } from "@/lib/utils";
import type { ActionType, AgentId, Recommendation } from "@/types";

export const Route = createFileRoute("/decision-room")({
  validateSearch: (s: Record<string, unknown>): { rec?: string } => ({ rec: typeof s.rec === "string" ? s.rec : undefined }),
  head: () => ({
    meta: [
      { title: "AI Decision Room — FreshMind AI" },
      { name: "description", content: "Six specialised agents propose actions; a coordinator selects a feasible plan for human approval." },
      { property: "og:title", content: "AI Decision Room — FreshMind AI" },
      { property: "og:description", content: "Multi-agent coordination with human-in-the-loop approvals." },
    ],
  }),
  component: DecisionRoom,
});

export const AGENTS: { id: AgentId; name: string; icon: typeof Bot; task: string }[] = [
  { id: "demand", name: "Demand Agent", icon: TrendingUp, task: "Forecasts per-store daily demand over the horizon" },
  { id: "freshness", name: "Freshness Agent", icon: Snowflake, task: "Scores batch spoilage risk from shelf life & sell-through" },
  { id: "replenishment", name: "Replenishment Agent", icon: RefreshCcw, task: "Adjusts inbound orders vs. safety stock" },
  { id: "markdown", name: "Markdown Agent", icon: Percent, task: "Proposes discounts within markdown limits" },
  { id: "transfer", name: "Transfer Agent", icon: Truck, task: "Matches surplus to shortages across stores" },
  { id: "rescue", name: "Food Rescue Agent", icon: HeartHandshake, task: "Checks donation eligibility & partner capacity" },
];

const ACTION_ICON: Record<ActionType, typeof Bot> = { markdown: Percent, transfer: Truck, replenish: RefreshCcw, reduce_order: Ban, donate: HeartHandshake, no_action: CircleDot };

function DecisionRoom() {
  const { recs, approve, reject } = useFreshMind();
  const { rec } = Route.useSearch();
  const navigate = useNavigate({ from: "/decision-room" });
  const [filter, setFilter] = useState<"open" | "all" | "approved" | "rejected">("open");
  const [editing, setEditing] = useState<Recommendation | null>(null);
  const [rationale, setRationale] = useState<Recommendation | null>(null);
  const [lastRun] = useState(() => new Date());

  const list = useMemo(() => recs.filter((r) =>
    filter === "all" ? true : filter === "open" ? r.status === "pending" || r.status === "edited" : r.status === filter), [recs, filter]);
  const selected = recs.find((r) => r.id === rec) ?? list[0];
  useEffect(() => { if (!rec && list[0]) navigate({ search: { rec: list[0].id }, replace: true }); }, [rec, list, navigate]);

  return (
    <div>
      <PageHeader title="AI Decision Room" desc="Agents propose, the coordinator selects a feasible plan, and you decide. Agent activity is simulated with deterministic rules — no live AI models are connected."
        actions={<SimTag>Simulated agents</SimTag>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {AGENTS.map((a, i) => {
          const n = recs.reduce((s, r) => s + r.decision.proposals.filter((p) => p.agent === a.id).length, 0);
          return (
            <div key={a.id} className="surface p-4">
              <div className="flex items-center justify-between">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><a.icon className="h-4 w-4" /></span>
                <span className="flex items-center gap-1 text-[11px] text-risk-low"><span className="h-1.5 w-1.5 rounded-full bg-risk-low" />Idle</span>
              </div>
              <div className="mt-2.5 text-sm font-semibold">{a.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{a.task}</div>
              <div className="mt-2 flex justify-between text-[11px]"><span className="num">{n} proposals</span><span className="num text-muted-foreground">{new Date(lastRun.getTime() - i * 41000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,380px)_1fr]">
        <Panel title="Recommendation feed" right={
          <div className="flex rounded-lg border p-0.5 text-[11px]">{(["open", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-md px-2 py-1 capitalize", filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{f}</button>))}</div>}>
          <div className="max-h-[900px] space-y-2 overflow-y-auto pr-1">
            {list.length === 0 && <Empty title="Nothing here" desc="No recommendations with this status." />}
            {list.map((r) => {
              const Icon = ACTION_ICON[r.action];
              return (
                <button key={r.id} onClick={() => navigate({ search: { rec: r.id } })} className={cn("w-full rounded-xl border p-3 text-left transition-colors", selected?.id === r.id ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                  <div className="flex items-center justify-between"><span className="num text-[11px] text-muted-foreground">{r.id}</span><StatusBadge status={r.status} /></div>
                  <div className="mt-1.5 flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">{ACTION_LABEL[r.action]}</span></div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{product(r.productId).name} · Store {r.storeId}{r.targetStoreId ? ` → ${r.targetStoreId}` : ""} · {r.quantity}u</div>
                  <div className="num mt-1.5 flex gap-3 text-[11px]"><span className="text-risk-low">+{inr(r.financialImpact)}</span><span>−{r.wasteImpact}u waste</span><span className="text-muted-foreground">{Math.round(r.confidence * 100)}% conf.</span></div>
                </button>
              );
            })}
          </div>
        </Panel>

        {selected ? <RecDetail r={selected} onApprove={() => approve(selected.id)} onReject={() => reject(selected.id)} onEdit={() => setEditing(selected)} onRationale={() => setRationale(selected)} /> : <Empty title="Select a recommendation" />}
      </div>

      {editing && <EditDialog r={editing} onClose={() => setEditing(null)} />}
      <Dialog open={!!rationale} onOpenChange={(o) => !o && setRationale(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Coordinator rationale · {rationale?.id}</DialogTitle><DialogDescription>Deterministic rule-based selection (simulated).</DialogDescription></DialogHeader>
          {rationale && <div className="space-y-3 text-sm"><p>{rationale.decision.rationale}</p><ul className="list-disc space-y-1 pl-5 text-muted-foreground">{rationale.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
            <p className="text-xs text-muted-foreground">Objective: projected margin − 1.5 × unit cost × wasted units − 0.2 × action cost, over feasible options only.</p></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecDetail({ r, onApprove, onReject, onEdit, onRationale }: { r: Recommendation; onApprove: () => void; onReject: () => void; onEdit: () => void; onRationale: () => void }) {
  const { settings, activity } = useFreshMind();
  const p = product(r.productId);
  const closed = r.status === "approved" || r.status === "rejected";
  const proposals = r.decision.proposals;
  const best = proposals.find((x) => x.action === r.decision.selected);
  const partner = PARTNERS.find((x) => x.id === r.partnerId);
  const decisionLog = activity.find((a) => a.recId === r.id && (a.kind === "approval" || a.kind === "rejection" || a.kind === "edit"));

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><span className="num text-xs text-muted-foreground">{r.id}</span><StatusBadge status={r.status} /></div>
            <h2 className="mt-1 text-xl font-semibold">{ACTION_LABEL[r.action]}{r.discountPct ? ` · ${r.discountPct}% off` : ""}</h2>
            <div className="text-sm text-muted-foreground">{p.name} <span className="num">({p.sku})</span> · {storeName(r.storeId, settings)}{r.targetStoreId && ` → ${storeName(r.targetStoreId, settings)}`}{partner && ` → ${partner.name}`}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRationale}><FileSearch className="mr-1 h-4 w-4" />View rationale</Button>
            <Button variant="outline" size="sm" onClick={onEdit} disabled={closed}><Pencil className="mr-1 h-4 w-4" />Edit</Button>
            <Button variant="outline" size="sm" onClick={onReject} disabled={closed}><X className="mr-1 h-4 w-4" />Reject</Button>
            <Button size="sm" onClick={onApprove} disabled={closed}><Check className="mr-1 h-4 w-4" />Approve</Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[["Quantity", `${r.quantity} units`], ["Timing", r.timing], ["Confidence (sim.)", `${Math.round(r.confidence * 100)}%`], ["Financial impact", `+${inr(r.financialImpact)}`], ["Waste avoided", `${r.wasteImpact} units`], ["Batch", r.batchId], ["Source agent", r.agent], ["Created", new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-muted p-2.5"><div className="text-[11px] text-muted-foreground">{l}</div><div className="num truncate text-sm font-semibold capitalize">{v}</div></div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div><div className="mb-1 text-xs font-semibold">Supporting evidence</div><ul className="space-y-1 text-xs text-muted-foreground">{r.evidence.map((e) => <li key={e} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{e}</li>)}</ul></div>
          <div><div className="mb-1 text-xs font-semibold">Constraints & risks</div><ul className="space-y-1 text-xs text-muted-foreground">{r.risks.map((e) => <li key={e} className="flex gap-1.5"><XCircle className="mt-0.5 h-3 w-3 shrink-0 text-risk-med" />{e}</li>)}</ul></div>
        </div>
      </Panel>

      <div className="coordinator-surface p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Gauge className="h-5 w-5" /><span className="font-display font-semibold">Coordinator</span></div>
          <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] uppercase tracking-wider opacity-80">Rule engine · OR-Tools ready</span>
        </div>
        <p className="mt-2 text-sm opacity-90">{r.decision.rationale}</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((x) => (
            <div key={x.id} className={cn("rounded-lg border p-3 text-xs", x.action === r.decision.selected ? "border-sidebar-primary bg-sidebar-primary/15" : "border-current/15", !x.feasible && "opacity-60")}>
              <div className="flex items-center justify-between"><span className="font-semibold">{ACTION_LABEL[x.action]}</span>
                {x.action === r.decision.selected ? <span className="rounded bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground">SELECTED</span> : x.feasible ? <span className="opacity-70">feasible</span> : <span className="text-risk-med">infeasible</span>}</div>
              <div className="mt-1 opacity-75">{x.note}</div>
              {x.violations.map((v) => <div key={v} className="mt-1 text-risk-med">⚠ {v}</div>)}
              <div className="num mt-2 flex justify-between opacity-90"><span>waste {fmt(x.projectedWaste)}u</span><span>margin {inr(x.projectedMargin)}</span></div>
            </div>
          ))}
        </div>
      </div>

      <Panel title="Option comparison" sub="Projected outcomes for this issue (simulated)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Option</th><th className="text-right font-medium">Waste (u)</th><th className="text-right font-medium">Margin</th><th className="text-right font-medium">Action cost</th><th className="text-right font-medium">Availability</th><th className="pl-4 font-medium">Feasibility</th></tr></thead>
            <tbody>
              {proposals.map((x) => (
                <tr key={x.id} className={cn("border-b", x.action === r.decision.selected && "bg-primary-soft")}>
                  <td className="py-2 font-medium">{ACTION_LABEL[x.action]}</td>
                  <td className="num text-right">{fmt(x.projectedWaste)}</td><td className="num text-right">{inr(x.projectedMargin)}</td>
                  <td className="num text-right">{inr(x.cost)}</td><td className="num text-right">{x.availability}%</td>
                  <td className="pl-4 text-xs">{x.feasible ? <span className="text-risk-low">Feasible</span> : <span className="text-risk-high">{x.violations[0]}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {best && <p className="mt-2 text-xs text-muted-foreground">Donation and transfer are not assumed best: they are selected only if shelf life, receiving capacity, travel time and food-safety rules pass.</p>}
      </Panel>

      <Panel title="Decision trace">
        <ol className="relative space-y-4 border-l pl-5">
          {[
            ["Issue detected", `Freshness Agent flagged ${p.name} at Store ${r.storeId}`, true],
            ["Agents evaluated options", `${proposals.length} proposals from ${new Set(proposals.map((x) => x.agent)).size} agents`, true],
            ["Coordinator compared proposals", `${proposals.filter((x) => x.feasible).length} feasible, ${proposals.filter((x) => !x.feasible).length} infeasible`, true],
            ["Constraints checked", "Shelf life at arrival, capacity, markdown floor, food safety", true],
            ["Recommendation generated", `${ACTION_LABEL[r.action]} · ${r.quantity} units`, true],
            ["Planner decision", decisionLog ? `${decisionLog.summary} — ${decisionLog.actor}` : "Awaiting planner", false],
          ].map(([t, d, sim], i) => (
            <li key={i}>
              <span className={cn("absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full", i === 5 && !decisionLog ? "bg-risk-med" : "bg-primary")} />
              <div className="flex items-center gap-2 text-sm font-medium">{t as string}<span className={cn("rounded px-1.5 text-[10px]", sim ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{sim ? "simulated event" : "user action"}</span></div>
              <div className="text-xs text-muted-foreground">{d as string}</div>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

function EditDialog({ r, onClose }: { r: Recommendation; onClose: () => void }) {
  const { edit } = useFreshMind();
  const [qty, setQty] = useState(String(r.quantity));
  const [action, setAction] = useState<ActionType>(r.action);
  const [timing, setTiming] = useState(r.timing);
  const n = Number(qty);
  const err = !Number.isInteger(n) || n <= 0 ? "Quantity must be a positive whole number" : n > 1000 ? "Quantity cannot exceed 1000 units" : !timing.trim() ? "Timing is required" : timing.length > 60 ? "Timing must be under 60 characters" : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {r.id}</DialogTitle><DialogDescription>Changes update simulated state only.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as ActionType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(ACTION_LABEL) as ActionType[]).map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL[a]}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="q">Quantity</Label><Input id="q" className="mt-1" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><Label htmlFor="t">Timing</Label><Input id="t" className="mt-1" value={timing} onChange={(e) => setTiming(e.target.value)} /></div>
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!!err} onClick={() => { edit(r.id, { quantity: n, action, timing: timing.trim() }); onClose(); }}>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
