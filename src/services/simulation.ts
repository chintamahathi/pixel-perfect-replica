// Deterministic CrisisArena engine. Same inputs -> same outputs.
import { PRODUCTS, STORES, baseDemand, route } from "@/data/seed";
import type { InventoryBatch, Settings, SimulationResult, SimulationScenario, StoreId, StrategyOutcome } from "@/types";
import { analyzeBatches, product } from "./logic";

export const SCENARIO_PRESETS: Record<SimulationScenario["kind"], { label: string; desc: string; patch: Partial<SimulationScenario> }> = {
  surge: { label: "Unexpected demand surge", desc: "Demand jumps across the selected scope.", patch: { demandChangePct: 40, deliveryDelayDays: 0, weatherImpactPct: 0, promotionIntensity: 1 } },
  drop: { label: "Sudden demand drop", desc: "Footfall falls; perishables pile up.", patch: { demandChangePct: -35, deliveryDelayDays: 0, weatherImpactPct: 0, promotionIntensity: 0 } },
  delay: { label: "Delivery delay", desc: "Inbound replenishment arrives late.", patch: { demandChangePct: 0, deliveryDelayDays: 2, weatherImpactPct: 0, promotionIntensity: 0 } },
  event: { label: "Local event increases demand", desc: "Nearby festival spikes short-term demand.", patch: { demandChangePct: 25, deliveryDelayDays: 0, weatherImpactPct: 0, promotionIntensity: 2 } },
  weather: { label: "Weather changes demand", desc: "Heavy rain suppresses visits, shifts mix.", patch: { demandChangePct: -10, deliveryDelayDays: 1, weatherImpactPct: -20, promotionIntensity: 0 } },
  excess: { label: "Excess inventory near expiry", desc: "Over-delivery leaves surplus close to expiry.", patch: { demandChangePct: -15, deliveryDelayDays: 0, weatherImpactPct: 0, promotionIntensity: 0 } },
};

export const SEVERITY_MULT = { low: 0.6, medium: 1, high: 1.5 };

export function defaultScenario(): SimulationScenario {
  return {
    kind: "surge", storeId: "all", category: "all", durationDays: 3, severity: "medium",
    demandChangePct: 40, deliveryDelayDays: 0, promotionIntensity: 1, weatherImpactPct: 0,
    transferCapacity: 120, markdownLimitPct: 30,
  };
}

interface Cell { productId: string; storeId: StoreId; stock: number; expiring: number; demand: number; inbound: number }

function buildCells(batches: InventoryBatch[], sc: SimulationScenario): Cell[] {
  const sev = SEVERITY_MULT[sc.severity];
  const mult = Math.max(0.1, 1 + ((sc.demandChangePct * sev) / 100)) * (1 + (sc.weatherImpactPct * sev) / 100) * (1 + sc.promotionIntensity * 0.06);
  const cells: Cell[] = [];
  for (const p of PRODUCTS) for (const s of STORES) {
    const inScope = (sc.storeId === "all" || sc.storeId === s.id) && (sc.category === "all" || sc.category === p.category);
    const bs = batches.filter((b) => b.productId === p.id && b.storeId === s.id);
    const extra = sc.kind === "excess" && inScope ? 1.35 : 1;
    const stock = Math.round(bs.reduce((x, b) => x + b.quantity, 0) * extra);
    const expiring = Math.round(bs.filter((b) => b.expiryDay <= sc.durationDays).reduce((x, b) => x + b.quantity, 0) * extra);
    const d = baseDemand(p.id, s.id) * (inScope ? mult : 1);
    const inboundDays = Math.max(0, sc.durationDays - (inScope ? sc.deliveryDelayDays : 0));
    cells.push({ productId: p.id, storeId: s.id, stock, expiring, demand: d * sc.durationDays, inbound: Math.round(baseDemand(p.id, s.id) * inboundDays * 0.9) });
  }
  return cells;
}

function outcome(name: StrategyOutcome["strategy"], cells: Cell[], opts: { transfer: boolean; markdown: boolean; coordinated: boolean }, sc: SimulationScenario, settings: Settings) {
  let waste = 0, wasteValue = 0, stockout = 0, demandTotal = 0, invCost = 0, mdCost = 0, trCost = 0, margin = 0, violations = 0;
  const transfers: SimulationResult["transfers"] = [];
  const markdowns: SimulationResult["markdowns"] = [];
  const state = cells.map((c) => ({ ...c, surplus: 0, short: 0, inboundAdj: c.inbound }));
  // Coordinated agentic: reduce inbound for surplus cells
  for (const c of state) {
    const avail = c.stock + c.inboundAdj;
    if (opts.coordinated && avail > c.demand * 1.2) c.inboundAdj = Math.max(0, Math.round(c.inboundAdj - (avail - c.demand * 1.1)));
    const sold = Math.min(c.stock + c.inboundAdj, c.demand);
    const expiringUnsold = Math.max(0, c.expiring - Math.min(c.expiring, c.demand));
    c.surplus = expiringUnsold;
    c.short = Math.max(0, Math.round(c.demand - (c.stock + c.inboundAdj)));
    void sold;
  }
  let capLeft = sc.transferCapacity;
  if (opts.transfer) {
    for (const p of PRODUCTS) {
      const rows = state.filter((c) => c.productId === p.id);
      for (const src of rows.filter((r) => r.surplus > 0).sort((a, b) => b.surplus - a.surplus)) {
        for (const dst of rows.filter((r) => r.short > 0)) {
          if (capLeft <= 0) break;
          const r = route(src.storeId, dst.storeId);
          const shelfOk = p.shelfLifeDays > 2 || r.hours < 1;
          if (opts.coordinated && !shelfOk) continue;
          const q = Math.min(src.surplus, dst.short, capLeft);
          if (q <= 0) continue;
          if (!shelfOk) violations++;
          src.surplus -= q; dst.short -= q; capLeft -= q;
          trCost += q * settings.transferCostPerUnit * (r.km / 10);
          transfers.push({ product: p.name, from: src.storeId, to: dst.storeId, qty: Math.round(q) });
        }
      }
    }
  }
  for (const c of state) {
    const p = product(c.productId);
    if (opts.markdown && c.surplus > 0) {
      const pct = Math.min(sc.markdownLimitPct, opts.coordinated ? 25 : sc.markdownLimitPct);
      const recovered = Math.round(c.surplus * Math.min(0.85, (pct / 100) * (opts.coordinated ? 2.6 : 2)));
      c.surplus -= recovered;
      mdCost += recovered * p.price * (pct / 100);
      margin += recovered * (p.price * (1 - pct / 100) - p.unitCost);
      if (recovered > 0) markdowns.push({ product: p.name, store: c.storeId, pct, qty: recovered });
    }
    if (opts.coordinated && settings.donationEnabled && p.donatable && c.surplus > 0) c.surplus = Math.round(c.surplus * 0.4);
    const sold = Math.min(c.stock + c.inboundAdj, c.demand);
    waste += c.surplus; wasteValue += c.surplus * p.unitCost;
    stockout += c.short; demandTotal += c.demand;
    invCost += (c.stock + c.inboundAdj) * p.unitCost * 0.02;
    margin += sold * (p.price - p.unitCost) - c.surplus * p.unitCost;
  }
  margin -= trCost;
  return {
    o: {
      strategy: name, wasteUnits: Math.round(waste), wasteValue: Math.round(wasteValue), stockoutUnits: Math.round(stockout),
      serviceLevel: Math.round((1 - stockout / Math.max(1, demandTotal)) * 1000) / 10, inventoryCost: Math.round(invCost),
      markdownCost: Math.round(mdCost), transferCost: Math.round(trCost), margin: Math.round(margin), violations,
    } as StrategyOutcome,
    transfers, markdowns, state,
  };
}

let simCounter = 1;
export function runSimulation(batches: InventoryBatch[], sc: SimulationScenario, settings: Settings): SimulationResult {
  const t0 = performance.now();
  const snapshot = batches.map((b) => ({ ...b })); // 1. copy state
  const cells = buildCells(snapshot, sc); // 2-3. apply scenario, project
  const base = outcome("Baseline", cells, { transfer: false, markdown: false, coordinated: false }, sc, settings);
  const opt = outcome("Optimization-only", cells, { transfer: true, markdown: true, coordinated: false }, sc, settings);
  const ag = outcome("Agentic", cells, { transfer: true, markdown: true, coordinated: true }, sc, settings);
  const computeMs = Math.round((performance.now() - t0) * 100) / 100;

  const agg = (st: typeof base.state, useShort: boolean) =>
    STORES.map((s) => {
      const rows = st.filter((c) => c.storeId === s.id);
      return {
        storeId: s.id,
        atRisk: Math.round(rows.reduce((x, c) => x + c.surplus, 0)),
        shortage: Math.round(rows.reduce((x, c) => x + (useShort ? c.short : 0), 0)),
        healthy: Math.round(rows.reduce((x, c) => x + Math.max(0, c.stock - c.surplus), 0)),
      };
    });
  const currentRisk = new Set(analyzeBatches(batches, settings).filter((a) => a.level === "high").map((a) => a.product.name + a.batch.storeId));
  const newHighRisk = base.state
    .filter((c) => c.surplus > c.stock * 0.4 && c.stock > 0 && !currentRisk.has(product(c.productId).name + c.storeId))
    .map((c) => `${product(c.productId).name} @ ${c.storeId}`)
    .slice(0, 8);
  const unresolved = ag.state.filter((c) => c.short > 10 || c.surplus > 15).map((c) => `${product(c.productId).name} @ Store ${c.storeId}: ${c.short > 10 ? `${Math.round(c.short)} short` : `${Math.round(c.surplus)} surplus`}`).slice(0, 6);
  return {
    id: `SIM-${String(simCounter++).padStart(3, "0")}`,
    name: SCENARIO_PRESETS[sc.kind].label,
    createdAt: new Date().toISOString(),
    scenario: { ...sc },
    outcomes: [base.o, opt.o, ag.o],
    computeMs,
    before: agg(base.state, true),
    after: agg(ag.state, true),
    newHighRisk,
    transfers: ag.transfers,
    markdowns: ag.markdowns.slice(0, 10),
    shortagesPrevented: Math.max(0, base.o.stockoutUnits - ag.o.stockoutUnits),
    unresolved,
  };
}
