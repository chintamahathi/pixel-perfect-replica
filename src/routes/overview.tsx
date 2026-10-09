import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Boxes, BrainCircuit, IndianRupee, PackageX, ShieldAlert, Trash2, Truck } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { CHART_COLORS, KpiCard, PageHeader, Panel, RiskBadge, SimTag, StatusBadge, tooltipStyle } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PRODUCTS, STORES, baseDemand } from "@/data/seed";
import { ACTION_LABEL, fmt, inr, product, shortage, storeName } from "@/services/logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Network Overview — FreshMind AI" },
      { name: "description", content: "Command-center view of stock, expiry risk, predicted waste and AI recommendations across the grocery network." },
      { property: "og:title", content: "Network Overview — FreshMind AI" },
      { property: "og:description", content: "Executive dashboard for zero-waste grocery operations." },
    ],
  }),
  component: Overview,
});

const dayLabel = (d: number) => {
  const dt = new Date("2026-10-09"); dt.setDate(dt.getDate() + d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function Overview() {
  const { batches, analysis, recs, sales, settings } = useFreshMind();
  const navigate = useNavigate();
  const [range, setRange] = useState<7 | 14>(14);

  const k = useMemo(() => {
    const units = batches.reduce((s, b) => s + b.quantity, 0);
    const value = batches.reduce((s, b) => s + b.quantity * product(b.productId).unitCost, 0);
    const atRisk = analysis.filter((a) => a.level !== "low").reduce((s, a) => s + a.unsold, 0);
    const wasteVal = analysis.reduce((s, a) => s + a.unsold * a.product.unitCost, 0);
    let stockouts = 0;
    PRODUCTS.forEach((p) => STORES.forEach((s) => { if (shortage(batches, p.id, s.id, settings) > 0) stockouts++; }));
    const pending = recs.filter((r) => r.status === "pending" || r.status === "edited").length;
    return { units, value, atRisk, wasteVal, stockouts, pending };
  }, [batches, analysis, recs, settings]);

  const storeStats = STORES.map((s) => {
    const a = analysis.filter((x) => x.batch.storeId === s.id);
    const stock = a.reduce((x, y) => x + y.batch.quantity, 0);
    const risk = new Set(a.filter((x) => x.level === "high").map((x) => x.product.id)).size;
    const demand = PRODUCTS.reduce((x, p) => x + baseDemand(p.id, s.id), 0) * settings.forecastHorizon;
    const alerts = PRODUCTS.filter((p) => shortage(batches, p.id, s.id, settings) > 0).length;
    const value = a.reduce((x, y) => x + y.batch.quantity * y.product.unitCost, 0);
    const health = Math.max(0, 100 - risk * 8 - alerts * 4);
    return { s, stock, risk, demand, alerts, value, health };
  });

  const trend = useMemo(() => {
    const days: Record<number, { day: string; forecast: number; actual: number; surplus: number; stockout: number }> = {};
    sales.forEach((r) => {
      if (r.day < -(range - 1)) return;
      const d = (days[r.day] ??= { day: dayLabel(r.day), forecast: 0, actual: 0, surplus: 0, stockout: 0 });
      d.forecast += r.forecast; d.actual += r.units;
      d.surplus += Math.max(0, r.forecast - r.units); d.stockout += Math.max(0, r.units - r.forecast);
    });
    return Object.keys(days).map(Number).sort((a, b) => a - b).map((k) => days[k]);
  }, [sales, range]);

  const freshDist = (["low", "medium", "high"] as const).map((l) => ({ name: l, value: analysis.filter((a) => a.level === l).reduce((s, a) => s + a.batch.quantity, 0) }));
  const catRisk = settings.categories.map((c) => ({ category: c, value: Math.round(analysis.filter((a) => a.product.category === c).reduce((s, a) => s + a.unsold * a.product.unitCost, 0)) }));

  const top = [...analysis].sort((a, b) => b.score - a.score);
  const milk = top.find((a) => a.product.id === "p1");
  const bakeryA = top.find((a) => a.product.category === "Bakery" && a.batch.storeId === "A");
  const dairyB = PRODUCTS.filter((p) => p.category === "Dairy").map((p) => ({ p, sh: shortage(batches, p.id, "B", settings) })).sort((a, b) => b.sh - a.sh)[0];
  const stockoutRec = recs.find((r) => r.action === "replenish");
  const alerts = [
    milk && { icon: AlertTriangle, tone: "high", title: `${milk.product.name} batch ${milk.batch.id} expires in ${milk.batch.expiryDay}d`, sub: `~${milk.unsold} units projected unsold at ${storeName(milk.batch.storeId, settings)}`, go: () => navigate({ to: "/inventory", search: { batch: milk.batch.id } }) },
    bakeryA && { icon: Trash2, tone: "high", title: `Bakery surplus at Store A`, sub: `${bakeryA.product.name}: ${bakeryA.unsold} units over forecast`, go: () => navigate({ to: "/inventory", search: { store: "A", category: "Bakery" } }) },
    dairyB && { icon: ShieldAlert, tone: "medium", title: `High predicted dairy demand at Store B`, sub: `${dairyB.p.name} short by ~${Math.max(0, dairyB.sh)} units over ${settings.forecastHorizon}d`, go: () => navigate({ to: "/inventory", search: { store: "B", category: "Dairy" } }) },
    { icon: Truck, tone: "medium", title: "Produce delivery delayed (simulated)", sub: "Lakeview vegetables inbound +6h — test impact in CrisisArena", go: () => navigate({ to: "/crisis-arena" }) },
    stockoutRec && { icon: PackageX, tone: "medium", title: `Potential stockout: ${product(stockoutRec.productId).name}`, sub: `Store ${stockoutRec.storeId} within forecast horizon · ${stockoutRec.id}`, go: () => navigate({ to: "/decision-room", search: { rec: stockoutRec.id } }) },
  ].filter(Boolean) as { icon: typeof Truck; tone: string; title: string; sub: string; go: () => void }[];

  return (
    <div>
      <PageHeader title="Network command center" desc="Live view of the synthetic three-store network. Predictions and risk scores are deterministic simulated estimates."
        actions={<Button asChild><Link to="/decision-room"><BrainCircuit className="mr-1.5 h-4 w-4" />Open AI Decision Room</Link></Button>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Units in stock" value={fmt(k.units)} icon={Boxes} hint="Sum of all batch quantities across the three stores." trend="Seeded snapshot" trendGood />
        <KpiCard label="Inventory value" value={inr(k.value)} icon={IndianRupee} hint="Quantity × unit cost across all batches." />
        <KpiCard label="Units at expiry risk" value={fmt(k.atRisk)} icon={AlertTriangle} tone="warn" hint="Projected unsold units in medium/high-risk batches (FIFO demand allocation, simulated)." trend="Predicted" />
        <KpiCard label="Predicted waste value" value={inr(k.wasteVal)} icon={Trash2} tone="risk" hint="Projected unsold units × unit cost if no action is taken. Simulated estimate." trend="If no action" />
        <KpiCard label="Stockout risks" value={String(k.stockouts)} icon={PackageX} tone="warn" hint={`Product–store pairs where stock is below forecast demand over ${settings.forecastHorizon} days plus safety stock.`} />
        <KpiCard label="Pending AI recs" value={String(k.pending)} icon={BrainCircuit} hint="Coordinator recommendations awaiting planner approval." />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {storeStats.map(({ s, stock, risk, demand, alerts, health }) => (
          <Link key={s.id} to="/inventory" search={{ store: s.id }} className="surface group p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Store {s.id}</div>
                <div className="font-display font-semibold">{settings.storeNames[s.id]}</div>
              </div>
              <div className={cn("num rounded-lg px-2.5 py-1 text-sm font-semibold", health >= 75 ? "bg-risk-low-soft text-risk-low" : health >= 55 ? "bg-risk-med-soft text-risk-med" : "bg-risk-high-soft text-risk-high")}>{health}</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {[["Stock", fmt(stock)], ["At risk", risk], ["Demand", fmt(demand)], ["Alerts", alerts]].map(([l, v]) => (
                <div key={l as string}><div className="num text-base font-semibold">{v}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>
              ))}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${health}%` }} /></div>
            <div className="mt-3 flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">View inventory <ArrowRight className="h-3 w-3" /></div>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Demand forecast vs actual sales" sub="All stores, units/day"
          right={<div className="flex rounded-lg border p-0.5 text-xs">{([7, 14] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={cn("rounded-md px-2.5 py-1", range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{r}d</button>))}</div>}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="actual" name="Actual sales" stroke="var(--chart-1)" fill="url(#ga)" strokeWidth={2} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="var(--chart-4)" strokeDasharray="5 4" dot={false} />
                <Area type="monotone" dataKey="forecast" name="Forecast" stroke="var(--chart-4)" strokeDasharray="5 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Freshness distribution" sub="Units by risk level">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={freshDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {freshDist.map((d) => <Cell key={d.name} fill={d.name === "low" ? "var(--risk-low)" : d.name === "medium" ? "var(--risk-med)" : "var(--risk-high)"} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Waste risk by category" sub="Projected waste value if no action (₹)" right={<SimTag />}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={catRisk}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="₹ at risk" radius={[6, 6, 0, 0]} fill="var(--chart-3)" /></BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Stockout & surplus trend" sub="Deviation between forecast and sales">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="surplus" name="Surplus" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                <Line dataKey="stockout" name="Under-forecast" stroke="var(--chart-2)" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Inventory value by store" sub="₹ at unit cost">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={storeStats.map((x) => ({ store: settings.storeNames[x.s.id], value: Math.round(x.value) }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="store" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="₹ value" radius={[6, 6, 0, 0]}>{storeStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Panel className="xl:col-span-2" title="Priority alerts">
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <button key={i} onClick={a.go} className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted">
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md", a.tone === "high" ? "bg-risk-high-soft text-risk-high" : "bg-risk-med-soft text-risk-med")}><a.icon className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-muted-foreground">{a.sub}</span></span>
                <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="xl:col-span-3" title="Recent coordinator decisions" right={<Link to="/decision-room" className="text-xs font-medium text-primary">View all</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Product</th><th className="pb-2 font-medium">Store</th><th className="pb-2 font-medium">Action</th><th className="pb-2 font-medium">Impact</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Time</th></tr></thead>
              <tbody>
                {[...recs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map((r) => {
                  const a = analysis.find((x) => x.batch.id === r.batchId);
                  return (
                    <tr key={r.id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => navigate({ to: "/decision-room", search: { rec: r.id } })}>
                      <td className="py-2.5"><div className="font-medium">{product(r.productId).name}</div>{a && <RiskBadge level={a.level} />}</td>
                      <td>{r.storeId}</td><td>{ACTION_LABEL[r.action]}</td>
                      <td className="num text-xs text-risk-low">+{inr(r.financialImpact)} · −{r.wasteImpact}u</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="num text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
