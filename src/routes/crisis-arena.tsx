import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play, RotateCcw, Save, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, PageHeader, Panel, SimTag, tooltipStyle } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { STORES } from "@/data/seed";
import { SCENARIO_PRESETS, defaultScenario, runSimulation } from "@/services/simulation";
import { fmt, inr } from "@/services/logic";
import { cn } from "@/lib/utils";
import type { SimulationResult, SimulationScenario, StoreId, Category } from "@/types";

export const Route = createFileRoute("/crisis-arena")({
  head: () => ({
    meta: [
      { title: "CrisisArena Simulation Lab — FreshMind AI" },
      { name: "description", content: "Stress-test grocery inventory decisions under demand shocks, delays and weather — baseline vs optimisation vs agentic." },
      { property: "og:title", content: "CrisisArena — FreshMind AI" },
      { property: "og:description", content: "Deterministic scenario simulation for perishable inventory." },
    ],
  }),
  component: CrisisArena,
});

const METRICS: { k: keyof SimulationResult["outcomes"][number]; label: string; fmt: (n: number) => string; better: "low" | "high" }[] = [
  { k: "wasteUnits", label: "Waste units", fmt, better: "low" },
  { k: "wasteValue", label: "Waste value", fmt: inr, better: "low" },
  { k: "stockoutUnits", label: "Stockout units", fmt, better: "low" },
  { k: "serviceLevel", label: "Service level", fmt: (n) => `${n}%`, better: "high" },
  { k: "inventoryCost", label: "Inventory holding cost", fmt: inr, better: "low" },
  { k: "markdownCost", label: "Markdown cost", fmt: inr, better: "low" },
  { k: "transferCost", label: "Transfer cost", fmt: inr, better: "low" },
  { k: "margin", label: "Estimated margin", fmt: inr, better: "high" },
  { k: "violations", label: "Constraint violations", fmt, better: "low" },
];

function CrisisArena() {
  const { batches, settings, simulations, saveSimulation, logSimulation } = useFreshMind();
  const [sc, setSc] = useState<SimulationScenario>(() => defaultScenario());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [compare, setCompare] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const set = (p: Partial<SimulationScenario>) => setSc((s) => ({ ...s, ...p }));
  const invalid = sc.durationDays < 1 || sc.durationDays > 14 || sc.transferCapacity < 0 || sc.transferCapacity > 1000;

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const r = runSimulation(batches, sc, settings);
      setResult(r); setCompare(null); setRunning(false); logSimulation(r);
    }, 500);
  };

  return (
    <div>
      <PageHeader title="CrisisArena simulation lab" desc="Apply a scenario to a copy of today's network state and compare strategies. Deterministic engine: same inputs, same outputs."
        actions={<><SimTag>Synthetic results</SimTag><Button variant="outline" size="sm" onClick={() => { setSc(defaultScenario()); setResult(null); setCompare(null); }}><RotateCcw className="mr-1 h-4 w-4" />Reset</Button></>} />

      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title="Scenario">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SCENARIO_PRESETS) as SimulationScenario["kind"][]).map((k) => (
              <button key={k} onClick={() => set({ kind: k, ...SCENARIO_PRESETS[k].patch })} className={cn("rounded-lg border p-2.5 text-left text-xs transition-colors", sc.kind === k ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                <div className="font-semibold">{SCENARIO_PRESETS[k].label}</div><div className="mt-0.5 text-muted-foreground">{SCENARIO_PRESETS[k].desc}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Select value={sc.storeId} onValueChange={(v) => set({ storeId: v as StoreId | "all" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stores</SelectItem>{STORES.map((s) => <SelectItem key={s.id} value={s.id}>Store {s.id}</SelectItem>)}</SelectContent></Select>
            <Select value={sc.category} onValueChange={(v) => set({ category: v as Category | "all" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-medium">Severity</div>
            <div className="flex rounded-lg border p-0.5">{(["low", "medium", "high"] as const).map((s) => <button key={s} onClick={() => set({ severity: s })} className={cn("flex-1 rounded-md py-1.5 text-xs capitalize", sc.severity === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{s}</button>)}</div>
          </div>
          <div className="mt-4 space-y-4">
            <Ctl label="Demand change" v={sc.demandChangePct} unit="%" min={-60} max={80} on={(n) => set({ demandChangePct: n })} />
            <Ctl label="Delivery delay" v={sc.deliveryDelayDays} unit="d" min={0} max={5} on={(n) => set({ deliveryDelayDays: n })} />
            <Ctl label="Promotion intensity" v={sc.promotionIntensity} unit="" min={0} max={5} on={(n) => set({ promotionIntensity: n })} />
            <Ctl label="Weather / event impact" v={sc.weatherImpactPct} unit="%" min={-40} max={40} on={(n) => set({ weatherImpactPct: n })} />
            <Ctl label="Markdown limit" v={sc.markdownLimitPct} unit="%" min={0} max={60} on={(n) => set({ markdownLimitPct: n })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-medium">Duration (days)<Input type="number" className="mt-1" value={sc.durationDays} onChange={(e) => set({ durationDays: Number(e.target.value) })} /></label>
              <label className="text-xs font-medium">Transfer capacity (u)<Input type="number" className="mt-1" value={sc.transferCapacity} onChange={(e) => set({ transferCapacity: Number(e.target.value) })} /></label>
            </div>
            {invalid && <p className="text-xs text-destructive">Duration must be 1–14 days and transfer capacity 0–1000 units.</p>}
          </div>
          <Button className="mt-5 w-full" size="lg" disabled={running || invalid} onClick={run}>{running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Run simulation</Button>
        </Panel>

        <div className="space-y-4">
          {!result ? (
            <div className="coordinator-surface grid min-h-80 place-items-center p-8 text-center">
              <div><Zap className="mx-auto h-10 w-10 opacity-80" /><div className="mt-3 font-display text-lg font-semibold">Choose a scenario and run it</div><p className="mt-1 max-w-md text-sm opacity-75">The engine copies the current state, applies the scenario, projects demand and inventory, generates actions, checks constraints and scores three strategies.</p></div>
            </div>
          ) : (
            <>
              <Panel title={`${result.id} · ${result.name}`} sub={`Engine time ${result.computeMs} ms (measured in browser) · ${result.scenario.durationDays}d · ${result.scenario.severity} severity`}
                right={<Button size="sm" variant="outline" onClick={() => saveSimulation(result)}><Save className="mr-1 h-4 w-4" />Save run</Button>}>
                <StrategyTable r={result} />
              </Panel>
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Waste & stockouts by strategy">
                  <div className="h-56"><ResponsiveContainer><BarChart data={result.outcomes}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="strategy" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="wasteUnits" name="Waste u" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /><Bar dataKey="stockoutUnits" name="Stockout u" fill="var(--chart-2)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </Panel>
                <Panel title="At-risk inventory: before vs after (agentic)">
                  <div className="h-56"><ResponsiveContainer><BarChart data={result.before.map((b, i) => ({ store: `Store ${b.storeId}`, before: b.atRisk, after: result.after[i].atRisk, shortB: b.shortage, shortA: result.after[i].shortage }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="store" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="before" name="Surplus before" fill="var(--risk-high)" radius={[4, 4, 0, 0]} /><Bar dataKey="after" name="Surplus after" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="shortB" name="Shortage before" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </Panel>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ListPanel title="Entering high risk" items={result.newHighRisk} empty="None" />
                <ListPanel title="Proposed transfers" items={result.transfers.map((t) => `${t.product}: ${t.from}→${t.to} · ${t.qty}u`)} empty="No feasible transfers" />
                <ListPanel title="Proposed markdowns" items={result.markdowns.map((m) => `${m.product} @${m.store}: ${m.pct}% · ${m.qty}u`)} empty="None" />
                <ListPanel title={`Shortages prevented: ${fmt(result.shortagesPrevented)}u · Unresolved`} items={result.unresolved} empty="All issues resolved" />
              </div>
            </>
          )}

          <Panel title="Simulation history" sub="Save runs, reopen, or compare two runs">
            {simulations.length === 0 ? <Empty title="No saved runs yet" desc="Run a scenario and click Save run." /> : (
              <div className="space-y-2">
                {simulations.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                    <span className="num text-xs text-muted-foreground">{s.id}</span><span className="font-medium">{s.name}</span>
                    <span className="num text-xs text-muted-foreground">Agentic waste {s.outcomes[2].wasteUnits}u · service {s.outcomes[2].serviceLevel}%</span>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setResult(s); setSc(s.scenario); setCompare(null); }}>Open</Button>
                      <Button size="sm" variant="outline" disabled={!result || result.id === s.id} onClick={() => setCompare(s)}>Compare with current</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {compare && result && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm"><thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Agentic metric</th><th className="text-right font-medium">{result.id}</th><th className="text-right font-medium">{compare.id}</th><th className="text-right font-medium">Δ</th></tr></thead>
                  <tbody>{METRICS.map((m) => { const a = result.outcomes[2][m.k] as number, b = compare.outcomes[2][m.k] as number; return (
                    <tr key={m.k} className="border-b"><td className="py-1.5">{m.label}</td><td className="num text-right">{m.fmt(a)}</td><td className="num text-right">{m.fmt(b)}</td><td className="num text-right">{a - b > 0 ? "+" : ""}{Math.round((a - b) * 10) / 10}</td></tr>); })}</tbody></table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Ctl({ label, v, unit, min, max, on }: { label: string; v: number; unit: string; min: number; max: number; on: (n: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs"><span className="font-medium">{label}</span><span className="num text-muted-foreground">{v > 0 && min < 0 ? "+" : ""}{v}{unit}</span></div>
      <Slider value={[v]} min={min} max={max} step={1} onValueChange={([n]) => on(n)} aria-label={label} />
    </div>
  );
}

function ListPanel({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? <p className="text-xs text-muted-foreground">{empty}</p> : <ul className="space-y-1 text-xs">{items.slice(0, 6).map((i) => <li key={i} className="rounded bg-muted px-2 py-1">{i}</li>)}</ul>}
    </Panel>
  );
}

function StrategyTable({ r }: { r: SimulationResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 font-medium">Metric</th>{r.outcomes.map((o) => <th key={o.strategy} className={cn("text-right font-medium", o.strategy === "Agentic" && "text-primary")}>{o.strategy}</th>)}</tr></thead>
        <tbody>
          {METRICS.map((m) => {
            const vals = r.outcomes.map((o) => o[m.k] as number);
            const best = m.better === "low" ? Math.min(...vals) : Math.max(...vals);
            return (
              <tr key={m.k} className="border-b">
                <td className="py-2">{m.label}</td>
                {vals.map((v, i) => <td key={i} className={cn("num text-right", v === best && "font-semibold text-primary")}>{m.fmt(v)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">Simulated results on synthetic data. Baseline = simple reorder rules; Optimization-only = transfers + markdowns ignoring shelf-life constraints; Agentic = coordinated proposals with constraint checks, order adjustment and eligible donation.</p>
    </div>
  );
}
