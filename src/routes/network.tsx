import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Truck } from "lucide-react";
import { Empty, PageHeader, Panel, SimTag } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PRODUCTS, ROUTES, STORES, route } from "@/data/seed";
import { evaluateBatch, fmt, inr, shortage, storeName } from "@/services/logic";
import { cn } from "@/lib/utils";
import type { StoreId } from "@/types";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Store Network — FreshMind AI" },
      { name: "description", content: "Interactive view of three connected stores, transfer routes and proposed inter-store transfers." },
      { property: "og:title", content: "Store Network — FreshMind AI" },
      { property: "og:description", content: "Surplus, shortage and transfer planning across the grocery network." },
    ],
  }),
  component: NetworkPage,
});

const POS: Record<StoreId, { x: number; y: number }> = { A: { x: 300, y: 70 }, B: { x: 90, y: 330 }, C: { x: 510, y: 330 } };

function NetworkPage() {
  const { analysis, batches, settings } = useFreshMind();
  const [sel, setSel] = useState<number>(0);

  const nodes = STORES.map((s) => {
    const a = analysis.filter((x) => x.batch.storeId === s.id);
    const surplus = a.reduce((t, x) => t + x.unsold, 0);
    const short = PRODUCTS.reduce((t, p) => t + Math.max(0, shortage(batches, p.id, s.id, settings)), 0);
    const high = new Set(a.filter((x) => x.level === "high").map((x) => x.product.id)).size;
    const value = a.reduce((t, x) => t + x.batch.quantity * x.product.unitCost, 0);
    const stock = a.reduce((t, x) => t + x.batch.quantity, 0);
    const health = stock ? Math.round(100 - (surplus / stock) * 100) : 100;
    return { s, surplus, short, high, value, health };
  });

  const transfers = useMemo(() => analysis.filter((a) => a.unsold > 0).map((a) => {
    const ev = evaluateBatch(a, batches, settings);
    const t = ev.proposals.find((p) => p.action === "transfer")!;
    const r = route(a.batch.storeId, ev.transferTarget);
    return { a, to: ev.transferTarget, qty: ev.tQty, cost: t.cost, hours: r.hours, shelf: a.batch.expiryDay - r.hours / 24, feasible: t.feasible, violations: t.violations, selected: ev.best.action === "transfer", ev };
  }).filter((t) => t.qty > 0 || t.violations.length).sort((x, y) => Number(y.feasible) - Number(x.feasible) || y.qty - x.qty).slice(0, 12), [analysis, batches, settings]);

  const cur = transfers[sel];
  return (
    <div>
      <PageHeader title="Store network" desc="Three connected stores and their transfer routes. Transfers shown here are proposals only — nothing is executed." actions={<SimTag />} />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Network graph" sub="Line weight = proposed transfer volume">
          <svg viewBox="0 0 600 420" className="h-auto w-full">
            {ROUTES.map((r) => {
              const vol = transfers.filter((t) => t.feasible && ((t.a.batch.storeId === r.from && t.to === r.to) || (t.a.batch.storeId === r.to && t.to === r.from))).reduce((s, t) => s + t.qty, 0);
              const a = POS[r.from], b = POS[r.to];
              const active = cur && ((cur.a.batch.storeId === r.from && cur.to === r.to) || (cur.a.batch.storeId === r.to && cur.to === r.from));
              return (
                <g key={r.from + r.to}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? "var(--primary)" : "var(--border)"} strokeWidth={2 + Math.min(10, vol / 15)} strokeLinecap="round" strokeDasharray={active ? "0" : "6 6"} />
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">{r.km} km · {r.hours}h{vol ? ` · ${vol}u` : ""}</text>
                </g>
              );
            })}
            {nodes.map(({ s, surplus, short, high, value, health }) => {
              const p = POS[s.id];
              return (
                <g key={s.id} transform={`translate(${p.x - 85}, ${p.y - 52})`}>
                  <rect width="170" height="104" rx="14" fill="var(--card)" stroke={health > 75 ? "var(--risk-low)" : health > 55 ? "var(--risk-med)" : "var(--risk-high)"} strokeWidth="2" />
                  <text x="14" y="24" className="fill-foreground text-[13px] font-semibold">Store {s.id} · {settings.storeNames[s.id]}</text>
                  <text x="14" y="44" className="fill-muted-foreground text-[11px]">Health {health} · {high} high-risk SKUs</text>
                  <text x="14" y="64" className="fill-risk-med text-[11px]">Surplus {fmt(surplus)}u</text>
                  <text x="96" y="64" className="fill-teal text-[11px]">Short {fmt(short)}u</text>
                  <text x="14" y="86" className="fill-foreground text-[12px] font-medium">{inr(value)}</text>
                </g>
              );
            })}
          </svg>
        </Panel>

        <Panel title="Transfer comparison" sub={cur ? `${cur.a.product.name}: ${storeName(cur.a.batch.storeId, settings)} → ${storeName(cur.to, settings)}` : ""}>
          {!cur ? <Empty title="No transfer candidates" /> : (
            <div className="space-y-3 text-sm">
              {cur.ev.proposals.filter((p) => ["no_action", "markdown", "transfer", "replenish", "reduce_order"].includes(p.action)).map((p) => (
                <div key={p.id} className={cn("flex items-center justify-between rounded-lg border p-3", p.action === "transfer" && "border-primary bg-primary-soft")}>
                  <div><div className="font-medium capitalize">{p.action.replace("_", " ")}</div><div className="text-xs text-muted-foreground">{p.note}</div></div>
                  <div className="num text-right text-xs"><div>waste {p.projectedWaste}u</div><div className="text-muted-foreground">{inr(p.projectedMargin)}</div></div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {cur.feasible
                  ? `A transfer reuses stock already paid for: it fills a ${cur.qty}-unit gap at the destination for ${inr(cur.cost)} in transport, instead of discounting margin at source and ordering fresh stock at destination.`
                  : `Transfer is infeasible here (${cur.violations.join("; ")}). Coordinator chose ${cur.ev.best.action.replace("_", " ")} instead.`}
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="Proposed transfers">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Product</th><th className="font-medium">Route</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Transport cost</th><th className="text-right font-medium">Travel</th><th className="text-right font-medium">Shelf at arrival</th><th className="pl-4 font-medium">Feasibility</th></tr></thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={t.a.batch.id} onClick={() => setSel(i)} className={cn("cursor-pointer border-b hover:bg-muted/50", i === sel && "bg-primary-soft")}>
                  <td className="py-2.5"><div className="font-medium">{t.a.product.name}</div><div className="num text-[11px] text-muted-foreground">{t.a.batch.id}</div></td>
                  <td><span className="inline-flex items-center gap-1">{t.a.batch.storeId}<ArrowRight className="h-3 w-3" />{t.to}</span></td>
                  <td className="num text-right">{t.qty}</td><td className="num text-right">{inr(t.cost)}</td><td className="num text-right">{t.hours}h</td><td className="num text-right">{t.shelf.toFixed(1)}d</td>
                  <td className="pl-4 text-xs">{t.feasible ? <span className="inline-flex items-center gap-1 text-risk-low"><Truck className="h-3 w-3" />Feasible{t.selected && " · selected"}</span> : <span className="text-risk-high">{t.violations[0]}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
