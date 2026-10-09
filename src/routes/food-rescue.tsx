import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { HandHeart, Leaf, PackageSearch, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, KpiCard, PageHeader, Panel, RiskBadge, SimTag } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PARTNERS } from "@/data/seed";
import { evaluateBatch, fmt, inr } from "@/services/logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/food-rescue")({
  head: () => ({
    meta: [
      { title: "Food Rescue — FreshMind AI" },
      { name: "description", content: "Identify surplus perishables and compare recovery options including eligible donation to fictional partners." },
      { property: "og:title", content: "Food Rescue — FreshMind AI" },
      { property: "og:description", content: "Surplus recovery workspace for zero-waste grocery." },
    ],
  }),
  component: FoodRescue,
});

function FoodRescue() {
  const { analysis, batches, settings, recs, createForBatch } = useFreshMind();
  const navigate = useNavigate();
  const surplus = useMemo(() => analysis.filter((a) => a.unsold > 0).sort((a, b) => a.batch.expiryDay - b.batch.expiryDay || b.unsold - a.unsold), [analysis]);
  const [selId, setSel] = useState<string | undefined>();
  const sel = surplus.find((s) => s.batch.id === selId) ?? surplus[0];
  const ev = sel ? evaluateBatch(sel, batches, settings) : null;

  const identified = surplus.reduce((s, a) => s + a.unsold, 0);
  const approved = recs.filter((r) => r.status === "approved" && ["donate", "transfer", "markdown"].includes(r.action));
  const recovered = approved.reduce((s, r) => s + r.wasteImpact, 0);
  const estimated = recs.filter((r) => (r.status === "pending" || r.status === "edited") && r.action !== "replenish").reduce((s, r) => s + r.wasteImpact, 0);
  const valueRecovered = approved.reduce((s, r) => s + r.financialImpact, 0);

  return (
    <div>
      <PageHeader title="Food rescue" desc="Surplus is routed to the best recovery option the rules allow. Donation partners are fictional demo entities." actions={<SimTag />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Surplus identified" value={`${fmt(identified)} u`} icon={PackageSearch} tone="warn" hint="Projected unsold units across all batches (estimate)." trend="Estimated" />
        <KpiCard label="Recovered in simulation" value={`${fmt(recovered)} u`} icon={Recycle} hint="Waste avoided by approved recommendations — confirmed within the demo state." trend="Approved actions" trendGood />
        <KpiCard label="Pending waste avoided" value={`${fmt(estimated)} u`} icon={Leaf} hint="Estimated waste avoided if pending recommendations are approved." trend="Estimated" />
        <KpiCard label="Value recovered (sim.)" value={inr(valueRecovered)} icon={HandHeart} hint="Margin improvement of approved recovery actions vs no action, in simulation." trendGood trend="Simulated" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Surplus batches">
          {surplus.length === 0 ? <Empty title="No projected surplus" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Product</th><th className="font-medium">Store</th><th className="text-right font-medium">Stock</th><th className="text-right font-medium">Sell-through</th><th className="text-right font-medium">Unsold</th><th className="pl-3 font-medium">Time left</th><th className="font-medium">Risk</th></tr></thead>
                <tbody>
                  {surplus.map((a) => (
                    <tr key={a.batch.id} onClick={() => setSel(a.batch.id)} className={cn("cursor-pointer border-b hover:bg-muted/50", sel?.batch.id === a.batch.id && "bg-primary-soft")}>
                      <td className="py-2.5 font-medium">{a.product.name}</td><td>{a.batch.storeId}</td>
                      <td className="num text-right">{a.batch.quantity}</td><td className="num text-right">{fmt(a.sellable)}</td><td className="num text-right text-risk-med">{fmt(a.unsold)}</td>
                      <td className="num pl-3">{a.batch.expiryDay * 24}h</td><td><RiskBadge level={a.level} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {sel && ev && (
          <Panel title="Recovery options" sub={`${sel.product.name} · ${sel.batch.id}`}>
            <div className="space-y-2">
              {(["no_action", "markdown", "transfer", "donate"] as const).map((k, i) => {
                const p = ev.proposals.find((x) => x.action === k)!;
                const labels = ["Keep current price", "Apply a discount", "Transfer to another store", "Offer to donation partner"];
                return (
                  <div key={k} className={cn("rounded-lg border p-3", ev.best.action === k && "border-primary bg-primary-soft", !p.feasible && "opacity-60")}>
                    <div className="flex items-center justify-between text-sm"><span className="font-medium">{i + 1}. {labels[i]}</span>{ev.best.action === k ? <span className="text-xs font-semibold text-primary">Best feasible</span> : !p.feasible && <span className="text-xs text-risk-high">Not eligible</span>}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.note}</div>
                    {p.violations.map((v) => <div key={v} className="text-xs text-risk-med">⚠ {v}</div>)}
                    <div className="num mt-1 text-xs">Waste {p.projectedWaste}u · Margin {inr(p.projectedMargin)}</div>
                  </div>
                );
              })}
              <Button className="mt-2 w-full" onClick={() => { const r = createForBatch(sel.batch.id); if (r) navigate({ to: "/decision-room", search: { rec: r.id } }); }}>Send to Decision Room</Button>
            </div>
          </Panel>
        )}
      </div>

      <h3 className="mb-3 mt-6 text-sm font-semibold">Donation partners <span className="font-normal text-muted-foreground">(fictional)</span></h3>
      <div className="grid gap-3 md:grid-cols-3">
        {PARTNERS.map((p) => {
          const elig = sel && settings.donationEnabled && sel.product.donatable && p.categories.includes(sel.product.category) && sel.batch.expiryDay >= Math.max(p.acceptsMinShelfDays, settings.minShelfForDonation);
          return (
            <div key={p.id} className="surface p-4">
              <div className="flex items-center justify-between"><span className="font-display font-semibold">{p.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", elig ? "bg-risk-low-soft text-risk-low" : "bg-muted text-muted-foreground")}>{elig ? "Eligible" : "Not eligible"}</span></div>
              <div className="mt-2 flex flex-wrap gap-1">{p.categories.map((c) => <span key={c} className="rounded bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">{c}</span>)}</div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs"><dt className="text-muted-foreground">Capacity</dt><dd className="num">{p.capacity} u/day</dd><dt className="text-muted-foreground">Pickup</dt><dd>{p.pickup}</dd><dt className="text-muted-foreground">Travel</dt><dd className="num">{p.travelMins} min</dd><dt className="text-muted-foreground">Min shelf life</dt><dd className="num">{p.acceptsMinShelfDays}d</dd></dl>
              {sel && <div className="mt-2 text-[11px] text-muted-foreground">For {sel.product.name} ({sel.batch.expiryDay}d left)</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
