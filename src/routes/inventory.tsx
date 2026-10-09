import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Apple, ArrowUpDown, Carrot, Croissant, Milk, Search, Sparkles, X } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, PageHeader, Panel, RiskBadge, SimTag, tooltipStyle } from "@/components/shared/ui-bits";
import { useFreshMind } from "@/hooks/use-freshmind";
import { PRODUCTS, STORES, SIM_TODAY } from "@/data/seed";
import { ACTION_LABEL, evaluateBatch, fmt, inr, shortage, storeName, type BatchAnalysis } from "@/services/logic";
import { cn } from "@/lib/utils";
import type { Category, StoreId } from "@/types";

type Search = { store?: StoreId; category?: Category; q?: string; batch?: string };

export const Route = createFileRoute("/inventory")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    store: ["A", "B", "C"].includes(s.store as string) ? (s.store as StoreId) : undefined,
    category: ["Dairy", "Bakery", "Fruits", "Vegetables"].includes(s.category as string) ? (s.category as Category) : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    batch: typeof s.batch === "string" ? s.batch : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Inventory & Freshness — FreshMind AI" },
      { name: "description", content: "Batch-level inventory, shelf life and freshness-risk scoring across the store network." },
      { property: "og:title", content: "Inventory & Freshness — FreshMind AI" },
      { property: "og:description", content: "Batch-level freshness-risk workspace with heatmap and drill-down." },
    ],
  }),
  component: InventoryPage,
});

export const CAT_ICON = { Dairy: Milk, Bakery: Croissant, Fruits: Apple, Vegetables: Carrot } as const;
const expiryDate = (d: number) => { const x = new Date(SIM_TODAY); x.setDate(x.getDate() + d); return x.toLocaleDateString("en-IN", { day: "numeric", month: "short" }); };
type SortKey = "score" | "expiry" | "qty" | "name";
const PAGE = 10;

function InventoryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/inventory" });
  const { analysis, batches, settings, createForBatch } = useFreshMind();
  const [q, setQ] = useState(search.q ?? "");
  const [risk, setRisk] = useState<string>("all");
  const [expiry, setExpiry] = useState<0 | 1 | 3 | 7>(0);
  const [surplusOnly, setSurplus] = useState(false);
  const [stockoutOnly, setStockout] = useState(false);
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "score", dir: -1 });
  const [page, setPage] = useState(0);
  useEffect(() => setQ(search.q ?? ""), [search.q]);

  const store = search.store ?? "all";
  const category = search.category ?? "all";
  const setParam = (patch: Partial<Search>) => { setPage(0); navigate({ search: (s) => ({ ...s, ...patch }) }); };

  const rows = useMemo(() => {
    let r = analysis.filter((a) => a.batch.quantity > 0);
    if (store !== "all") r = r.filter((a) => a.batch.storeId === store);
    if (category !== "all") r = r.filter((a) => a.product.category === category);
    if (risk !== "all") r = r.filter((a) => a.level === risk);
    if (expiry) r = r.filter((a) => a.batch.expiryDay <= expiry);
    if (surplusOnly) r = r.filter((a) => a.unsold > 0);
    if (stockoutOnly) r = r.filter((a) => shortage(batches, a.product.id, a.batch.storeId, settings) > 0);
    if (q) r = r.filter((a) => (a.product.name + a.product.sku + a.batch.id).toLowerCase().includes(q.toLowerCase()));
    const val = (a: BatchAnalysis) => sort.k === "score" ? a.score : sort.k === "expiry" ? a.batch.expiryDay : sort.k === "qty" ? a.batch.quantity : a.product.name;
    return [...r].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [analysis, store, category, risk, expiry, surplusOnly, stockoutOnly, q, sort, batches, settings]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);
  const selected = analysis.find((a) => a.batch.id === search.batch);
  const clear = () => { setQ(""); setRisk("all"); setExpiry(0); setSurplus(false); setStockout(false); setPage(0); navigate({ search: {} }); };
  const th = (k: SortKey, label: string) => (
    <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))}>{label}<ArrowUpDown className="h-3 w-3" /></button>
  );

  return (
    <div>
      <PageHeader title="Inventory & freshness" desc="Batch-level stock with FIFO demand allocation. Risk scores are simulated estimates derived from shelf life and forecast demand." actions={<SimTag>Synthetic dataset</SimTag>} />

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search product, SKU or batch" className="h-9 w-full rounded-lg border bg-card pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
          </div>
          <Select value={store} onValueChange={(v) => setParam({ store: v === "all" ? undefined : (v as StoreId) })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All stores</SelectItem>{STORES.map((s) => <SelectItem key={s.id} value={s.id}>Store {s.id} · {settings.storeNames[s.id]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => setParam({ category: v === "all" ? undefined : (v as Category) })}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All categories</SelectItem>{settings.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={risk} onValueChange={(v) => { setRisk(v); setPage(0); }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Any risk</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {([1, 3, 7] as const).map((d) => (
            <Chip key={d} on={expiry === d} onClick={() => { setExpiry(expiry === d ? 0 : d); setPage(0); }}>{d === 1 ? "Expires ≤ 24h" : `Expires ≤ ${d} days`}</Chip>
          ))}
          <Chip on={surplusOnly} onClick={() => { setSurplus(!surplusOnly); setPage(0); }}>Predicted surplus</Chip>
          <Chip on={stockoutOnly} onClick={() => { setStockout(!stockoutOnly); setPage(0); }}>Potential stockout</Chip>
          <button onClick={clear} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" />Clear all filters</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {view.length === 0 ? <Empty title="No batches match these filters" desc="Try clearing filters or widening the expiry window." /> : (
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2 font-medium">{th("name", "Product")}</th><th className="font-medium">Category</th><th className="font-medium">Store</th><th className="font-medium">Batch</th>
                  <th className="text-right font-medium">{th("qty", "Qty")}</th><th className="text-right font-medium">Cost</th><th className="text-right font-medium">Price</th>
                  <th className="pl-4 font-medium">{th("expiry", "Expiry")}</th><th className="font-medium">Shelf left</th><th className="text-right font-medium">Forecast/d</th>
                  <th className="pl-4 font-medium">{th("score", "Risk (sim.)")}</th><th className="font-medium">Recommended</th>
                </tr>
              </thead>
              <tbody>
                {view.map((a) => {
                  const Icon = CAT_ICON[a.product.category];
                  const rec = a.level === "low" ? "no_action" : evaluateBatch(a, batches, settings).best.action;
                  return (
                    <tr key={a.batch.id} onClick={() => navigate({ search: (s) => ({ ...s, batch: a.batch.id }) })} className="cursor-pointer border-b transition-colors hover:bg-muted/50">
                      <td className="py-2.5 pr-2"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary"><Icon className="h-4 w-4" /></span><div><div className="font-medium">{a.product.name}</div><div className="num text-[11px] text-muted-foreground">{a.product.sku}</div></div></div></td>
                      <td>{a.product.category}</td><td>{a.batch.storeId}</td><td className="num text-xs">{a.batch.id}</td>
                      <td className="num text-right">{a.batch.quantity}</td><td className="num text-right">{inr(a.product.unitCost)}</td><td className="num text-right">{inr(a.product.price)}</td>
                      <td className="pl-4">{expiryDate(a.batch.expiryDay)}</td>
                      <td><span className={cn("num", a.batch.expiryDay <= 1 ? "text-risk-high" : a.batch.expiryDay <= 3 ? "text-risk-med" : "")}>{a.batch.expiryDay}d</span></td>
                      <td className="num text-right">{a.dailyDemand}</td>
                      <td className="pl-4"><RiskBadge level={a.level} score={a.score} /></td>
                      <td className="text-xs">{ACTION_LABEL[rec]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{rows.length} batches</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="num">{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Panel>

      <Heatmap onPick={(id) => navigate({ search: (s) => ({ ...s, batch: id }) })} />

      <Sheet open={!!selected} onOpenChange={(o) => !o && navigate({ search: (s) => ({ ...s, batch: undefined }) })}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && <Detail a={selected} onCreate={() => { const r = createForBatch(selected.batch.id); if (r) navigate({ to: "/decision-room", search: { rec: r.id } }); }} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-full border px-3 py-1 transition-colors", on ? "border-primary bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted")}>{children}</button>;
}

function Detail({ a, onCreate }: { a: BatchAnalysis; onCreate: () => void }) {
  const { sales, batches, settings } = useFreshMind();
  const hist = sales.filter((s) => s.productId === a.product.id && s.storeId === a.batch.storeId).map((s) => ({ day: s.day, sold: s.units, forecast: s.forecast }));
  const traj = Array.from({ length: Math.max(a.batch.expiryDay, 1) + 2 }, (_, d) => ({ day: `D+${d}`, stock: Math.max(0, a.batch.quantity - a.dailyDemand * d), expired: d > a.batch.expiryDay ? Math.max(0, a.batch.quantity - a.dailyDemand * a.batch.expiryDay) : 0 }));
  const ev = evaluateBatch(a, batches, settings);
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display">{a.product.name}</SheetTitle>
        <SheetDescription>Batch {a.batch.id} · Store {a.batch.storeId} — {storeName(a.batch.storeId, settings)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        <div className="grid grid-cols-3 gap-2">
          {[["Quantity", fmt(a.batch.quantity)], ["Expires in", `${a.batch.expiryDay} day(s)`], ["Forecast", `${a.dailyDemand}/day`], ["SKU", a.product.sku], ["Unit cost", inr(a.product.unitCost)], ["Price", inr(a.product.price)]].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-muted p-2.5"><div className="text-[11px] text-muted-foreground">{l}</div><div className="num text-sm font-semibold">{v}</div></div>
          ))}
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">Freshness risk</span><RiskBadge level={a.level} score={a.score} /></div>
          <p className="mt-2 text-sm text-muted-foreground">{a.explanation}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Score = unsold ratio × 70 + urgency (≤1d: 30, ≤3d: 15). Simulated estimate.</p>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold">Recent sales vs forecast (14d)</div>
          <div className="h-40"><ResponsiveContainer><BarChart data={hist}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="sold" fill="var(--chart-1)" radius={[3, 3, 0, 0]} /><Bar dataKey="forecast" fill="var(--chart-5)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold">Projected inventory trajectory</div>
          <div className="h-40"><ResponsiveContainer><AreaChart data={traj}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip contentStyle={tooltipStyle} /><Area dataKey="stock" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} /><Area dataKey="expired" stroke="var(--risk-high)" fill="var(--risk-high)" fillOpacity={0.15} /></AreaChart></ResponsiveContainer></div>
        </div>
        <div className="rounded-xl bg-primary-soft p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />Suggested: {ACTION_LABEL[ev.best.action]}</div>
          <p className="mt-1 text-sm text-foreground">{ev.rationale}</p>
        </div>
        <Button className="w-full" onClick={onCreate}>Create recommendation for this batch</Button>
      </div>
    </>
  );
}

function Heatmap({ onPick }: { onPick: (batchId: string) => void }) {
  const { analysis, settings } = useFreshMind();
  return (
    <Panel className="mt-4" title="Freshness heatmap" sub="Worst batch risk per product × store. Click a cell to inspect." right={<SimTag />}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-1.5" style={{ gridTemplateColumns: "minmax(170px,1.4fr) repeat(3, 1fr)" }}>
          <div />
          {STORES.map((s) => <div key={s.id} className="pb-1 text-center text-xs font-medium text-muted-foreground">Store {s.id} · {settings.storeNames[s.id]}</div>)}
          {PRODUCTS.map((p) => (
            <div key={p.id} className="contents">
              <div className="flex items-center text-xs font-medium">{p.name}</div>
              {STORES.map((s) => {
                const worst = analysis.filter((a) => a.product.id === p.id && a.batch.storeId === s.id && a.batch.quantity > 0).sort((a, b) => b.score - a.score)[0];
                if (!worst) return <div key={s.id} className="rounded-md bg-muted py-2 text-center text-[11px] text-muted-foreground">—</div>;
                return (
                  <button key={s.id} onClick={() => onPick(worst.batch.id)} className={cn("num rounded-md py-2 text-center text-xs font-semibold transition-transform hover:scale-[1.03]",
                    worst.level === "high" ? "bg-risk-high text-destructive-foreground" : worst.level === "medium" ? "bg-risk-med-soft text-risk-med" : "bg-risk-low-soft text-risk-low")}>
                    {worst.score}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
