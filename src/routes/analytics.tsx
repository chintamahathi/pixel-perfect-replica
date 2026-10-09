import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, SimTag, tooltipStyle } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { STORES } from "@/data/seed";
import { inr, fmt, product } from "@/services/logic";
import { SCENARIO_PRESETS, defaultScenario, runSimulation } from "@/services/simulation";
import { cn } from "@/lib/utils";
import type { SimulationScenario } from "@/types";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics & Impact — FreshMind AI" },
      { name: "description", content: "Waste, service level, markdown and transfer analytics with baseline vs agentic strategy comparison." },
      { property: "og:title", content: "Analytics & Impact — FreshMind AI" },
      { property: "og:description", content: "Measured, calculated and synthetic metrics clearly distinguished." },
    ],
  }),
  component: Analytics,
});

const STATUS = {
  measured: "bg-risk-low-soft text-risk-low",
  calculated: "bg-accent text-accent-foreground",
  synthetic: "bg-risk-med-soft text-risk-med",
};
function Tag({ s }: { s: keyof typeof STATUS }) { return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", STATUS[s])}>{s}</span>; }

function Analytics() {
  const { sales, recs, batches, settings } = useFreshMind();
  const [range, setRange] = useState("14");
  const [store, setStore] = useState("all");
  const [cat, setCat] = useState("all");
  const [kind, setKind] = useState<SimulationScenario["kind"]>("surge");

  const daily = useMemo(() => {
    const m = new Map<number, { day: string; waste: number; wasteValue: number; forecast: number; sales: number; stockout: number; demand: number; markdown: number; transfer: number; recovered: number }>();
    sales.forEach((r) => {
      if (r.day < -(Number(range) - 1)) return;
      if (store !== "all" && r.storeId !== store) return;
      const p = product(r.productId);
      if (cat !== "all" && p.category !== cat) return;
      const dt = new Date("2026-10-09"); dt.setDate(dt.getDate() + r.day);
      const d = m.get(r.day) ?? { day: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), waste: 0, wasteValue: 0, forecast: 0, sales: 0, stockout: 0, demand: 0, markdown: 0, transfer: 0, recovered: 0 };
      const over = Math.max(0, r.forecast - r.units);
      const spoil = Math.round(over * (p.shelfLifeDays <= 4 ? 0.6 : 0.3));
      d.waste += spoil; d.wasteValue += spoil * p.unitCost;
      d.forecast += r.forecast; d.sales += r.units; d.demand += r.units;
      d.stockout += Math.max(0, r.units - r.forecast * 1.08);
      d.markdown += Math.round(over * 0.25 * p.price * 0.2);
      d.transfer += Math.round(over * 0.15);
      d.recovered += Math.round(over * 0.1);
      m.set(r.day, d);
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => ({ ...v, stockoutRate: Math.round((v.stockout / Math.max(1, v.demand)) * 1000) / 10, service: Math.round((1 - v.stockout / Math.max(1, v.demand)) * 1000) / 10 }));
  }, [sales, range, store, cat]);

  const sim = useMemo(() => runSimulation(batches, { ...defaultScenario(), kind, ...SCENARIO_PRESETS[kind].patch, storeId: store as SimulationScenario["storeId"], category: cat as SimulationScenario["category"] }, settings), [batches, kind, store, cat, settings]);
  const acc = (["approved", "edited", "pending", "rejected"] as const).map((s) => ({ name: s, value: recs.filter((r) => r.status === s).length }));
  const accRate = Math.round((acc[0].value / Math.max(1, acc[0].value + acc[3].value)) * 100);

  const ch = (title: string, tag: keyof typeof STATUS, node: React.ReactElement) => (
    <Panel title={title} right={<Tag s={tag} />}><div className="h-52"><ResponsiveContainer>{node}</ResponsiveContainer></div></Panel>
  );
  const axes = [<CartesianGrid key="g" strokeDasharray="3 3" stroke="var(--border)" vertical={false} />, <XAxis key="x" dataKey="day" tick={{ fontSize: 10 }} />, <YAxis key="y" tick={{ fontSize: 10 }} />, <Tooltip key="t" contentStyle={tooltipStyle} />];
  const metricRows: { label: string; k: keyof (typeof sim.outcomes)[number]; f: (n: number) => string }[] = [
    { label: "Waste units", k: "wasteUnits", f: fmt }, { label: "Waste value", k: "wasteValue", f: inr }, { label: "Stockout units", k: "stockoutUnits", f: fmt },
    { label: "Service level", k: "serviceLevel", f: (n) => `${n}%` }, { label: "Markdown cost", k: "markdownCost", f: inr }, { label: "Transfer cost", k: "transferCost", f: inr }, { label: "Estimated margin", k: "margin", f: inr },
  ];

  return (
    <div>
      <PageHeader title="Analytics & impact" desc="No figures here are validated in production. Each chart states whether it is measured from session state, calculated from rules, or synthetic." actions={<SimTag>Demo data</SimTag>} />
      <Panel>
        <div className="flex flex-wrap gap-2">
          <Select value={range} onValueChange={setRange}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="14">Last 14 days</SelectItem></SelectContent></Select>
          <Select value={store} onValueChange={setStore}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{STORES.map((s) => <SelectItem key={s.id} value={s.id}>Store {s.id}</SelectItem>)}</SelectContent></Select>
          <Select value={cat} onValueChange={setCat}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={kind} onValueChange={(v) => setKind(v as SimulationScenario["kind"])}><SelectTrigger className="w-56"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(SCENARIO_PRESETS) as SimulationScenario["kind"][]).map((k) => <SelectItem key={k} value={k}>{SCENARIO_PRESETS[k].label}</SelectItem>)}</SelectContent></Select>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ch("Daily waste units", "synthetic", <BarChart data={daily}>{axes}<Bar dataKey="waste" fill="var(--chart-3)" radius={[3, 3, 0, 0]} /></BarChart>)}
        {ch("Waste value (₹)", "synthetic", <LineChart data={daily}>{axes}<Line dataKey="wasteValue" stroke="var(--risk-high)" strokeWidth={2} dot={false} /></LineChart>)}
        {ch("Demand forecast vs sales", "synthetic", <LineChart data={daily}>{axes}<Legend wrapperStyle={{ fontSize: 11 }} /><Line dataKey="sales" stroke="var(--chart-1)" strokeWidth={2} dot={false} /><Line dataKey="forecast" stroke="var(--chart-4)" strokeDasharray="4 4" dot={false} /></LineChart>)}
        {ch("Stockout rate (%)", "calculated", <LineChart data={daily}>{axes}<Line dataKey="stockoutRate" stroke="var(--chart-2)" strokeWidth={2} dot={false} /></LineChart>)}
        {ch("Service level (%)", "calculated", <LineChart data={daily}>{axes}<Line dataKey="service" stroke="var(--chart-1)" strokeWidth={2} dot={false} /></LineChart>)}
        {ch("Markdown impact (₹ discount)", "synthetic", <BarChart data={daily}>{axes}<Bar dataKey="markdown" fill="var(--chart-4)" radius={[3, 3, 0, 0]} /></BarChart>)}
        {ch("Inter-store transfer volume", "synthetic", <BarChart data={daily}>{axes}<Bar dataKey="transfer" fill="var(--chart-2)" radius={[3, 3, 0, 0]} /></BarChart>)}
        {ch("Estimated food recovered (u)", "synthetic", <BarChart data={daily}>{axes}<Bar dataKey="recovered" fill="var(--chart-5)" radius={[3, 3, 0, 0]} /></BarChart>)}
        {ch(`Recommendation acceptance · ${accRate}%`, "measured", <PieChart><Pie data={acc} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>{acc.map((a, i) => <Cell key={a.name} fill={["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--muted-foreground)"][i]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart>)}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        {ch("Profit & cost by strategy (scenario)", "calculated", <BarChart data={sim.outcomes}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="strategy" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="margin" name="Margin" fill="var(--chart-1)" radius={[3, 3, 0, 0]} /><Bar dataKey="wasteValue" name="Waste value" fill="var(--risk-high)" radius={[3, 3, 0, 0]} /><Bar dataKey="transferCost" name="Transfer cost" fill="var(--chart-2)" radius={[3, 3, 0, 0]} /></BarChart>)}
        <Panel title="Strategy comparison" sub={`Scenario: ${SCENARIO_PRESETS[kind].label}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Metric</th><th className="text-right font-medium">Baseline</th><th className="text-right font-medium">Optimization-only</th><th className="text-right font-medium">Agentic</th><th className="text-right font-medium">Δ vs baseline</th><th className="pl-3 font-medium">Status</th></tr></thead>
              <tbody>
                {metricRows.map((m) => {
                  const [b, o, a] = sim.outcomes.map((x) => x[m.k] as number);
                  return (<tr key={m.k} className="border-b"><td className="py-2">{m.label}</td><td className="num text-right">{m.f(b)}</td><td className="num text-right">{m.f(o)}</td><td className="num text-right font-semibold text-primary">{m.f(a)}</td><td className="num text-right">{a - b > 0 ? "+" : ""}{fmt(a - b)}</td><td className="pl-3"><Tag s="calculated" /></td></tr>);
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Calculated by the deterministic CrisisArena engine on synthetic data. Not a real-world savings claim.</p>
        </Panel>
      </div>
    </div>
  );
}
