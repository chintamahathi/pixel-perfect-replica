// Deterministic business rules used by the demo. Replace with API calls in services/api.ts later.
import { PARTNERS, PRODUCTS, STORES, baseDemand, route } from "@/data/seed";
import type {
  ActionType, AgentProposal, InventoryBatch, Product, Recommendation, RiskLevel, Settings, StoreId,
} from "@/types";

export const product = (id: string) => PRODUCTS.find((p) => p.id === id)!;
export const storeName = (id: StoreId, s?: Settings) => (s ? s.storeNames[id] : STORES.find((x) => x.id === id)!.short);
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

export interface BatchAnalysis {
  batch: InventoryBatch;
  product: Product;
  dailyDemand: number;
  sellable: number;
  unsold: number;
  score: number;
  level: RiskLevel;
  explanation: string;
}

/** FIFO allocation of demand across batches of the same product/store, ordered by expiry. */
export function analyzeBatches(batches: InventoryBatch[], settings: Settings): BatchAnalysis[] {
  const groups = new Map<string, InventoryBatch[]>();
  batches.forEach((b) => {
    const k = b.productId + b.storeId;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  });
  const out: BatchAnalysis[] = [];
  groups.forEach((list) => {
    const sorted = [...list].sort((a, b) => a.expiryDay - b.expiryDay);
    const d = baseDemand(sorted[0].productId, sorted[0].storeId);
    let consumedDays = 0; // demand already consumed by earlier batches, in units
    let used = 0;
    for (const b of sorted) {
      const p = product(b.productId);
      const capacityUntilExpiry = Math.max(0, d * Math.max(b.expiryDay, 0) - used);
      const sellable = Math.min(b.quantity, capacityUntilExpiry);
      used += sellable;
      consumedDays += sellable / d;
      const unsold = b.quantity - sellable;
      const unsoldRatio = b.quantity ? unsold / b.quantity : 0;
      const urgency = b.expiryDay <= 1 ? 30 : b.expiryDay <= 3 ? 15 : 0;
      const score = Math.min(100, Math.round(unsoldRatio * 70 + urgency));
      const level: RiskLevel =
        score >= settings.highRiskThreshold ? "high" : score >= settings.mediumRiskThreshold ? "medium" : "low";
      const explanation =
        unsold > 0
          ? `At ~${d} units/day, about ${fmt(sellable)} of ${fmt(b.quantity)} units sell before expiry in ${b.expiryDay} day(s); ~${fmt(unsold)} units projected unsold.`
          : `Projected demand (~${d}/day) clears this batch before expiry in ${b.expiryDay} day(s).`;
      out.push({ batch: b, product: p, dailyDemand: d, sellable, unsold, score, level, explanation });
    }
  });
  return out;
}

export function stockFor(batches: InventoryBatch[], productId: string, storeId: StoreId) {
  return batches.filter((b) => b.productId === productId && b.storeId === storeId).reduce((s, b) => s + b.quantity, 0);
}

/** Positive = shortage over horizon. */
export function shortage(batches: InventoryBatch[], productId: string, storeId: StoreId, settings: Settings) {
  const need = baseDemand(productId, storeId) * settings.forecastHorizon + product(productId).minStock * settings.minStockMultiplier * 0.5;
  return Math.round(need - stockFor(batches, productId, storeId));
}

export const ACTION_LABEL: Record<ActionType, string> = {
  markdown: "Apply markdown",
  transfer: "Transfer stock",
  replenish: "Replenish inventory",
  reduce_order: "Reduce / postpone order",
  donate: "Propose donation",
  no_action: "Take no action",
};

/** Evaluate candidate actions for one at-risk batch and select via coordinator rules. */
export function evaluateBatch(a: BatchAnalysis, batches: InventoryBatch[], settings: Settings) {
  const { batch: b, product: p, unsold, dailyDemand } = a;
  const proposals: AgentProposal[] = [];
  const wasteVal = (u: number) => u * p.unitCost;
  const baseMargin = a.sellable * (p.price - p.unitCost) - wasteVal(unsold);

  proposals.push({
    id: "no_action", agent: "freshness", action: "no_action", feasible: true, violations: [],
    projectedWaste: unsold, projectedMargin: baseMargin, cost: 0, availability: 100,
    note: "Baseline: sell at current price, write off remainder.",
  });

  // Markdown
  const disc = Math.min(settings.maxMarkdownPct, unsold > 0 ? Math.ceil(Math.min(60, (unsold / Math.max(1, a.sellable)) * 40) / 5) * 5 || 10 : 10);
  const lift = 1 + (disc / 100) * 2.5;
  const mdSell = Math.min(b.quantity, Math.round(dailyDemand * lift * Math.max(b.expiryDay, 0.5)));
  const mdWaste = Math.max(0, b.quantity - mdSell);
  const mdPrice = p.price * (1 - disc / 100);
  const mdViol = mdPrice < p.unitCost * 0.6 ? ["Price falls below 60% of unit cost"] : [];
  proposals.push({
    id: "markdown", agent: "markdown", action: "markdown", feasible: mdViol.length === 0, violations: mdViol,
    projectedWaste: mdWaste, projectedMargin: mdSell * (mdPrice - p.unitCost) - wasteVal(mdWaste),
    cost: mdSell * (p.price - mdPrice), availability: 100,
    note: `${disc}% off lifts demand ~${Math.round((lift - 1) * 100)}% (simulated elasticity).`,
  });

  // Transfer
  const targets = STORES.filter((s) => s.id !== b.storeId)
    .map((s) => ({ s, short: shortage(batches, p.id, s.id, settings), r: route(b.storeId, s.id) }))
    .sort((x, y) => y.short - x.short);
  const t = targets[0];
  const tQty = Math.max(0, Math.min(unsold, t.short, settings.maxTransferCapacity));
  const shelfAtArrival = b.expiryDay - t.r.hours / 24;
  const tViol: string[] = [];
  if (t.short <= 0) tViol.push(`No shortage at ${storeName(t.s.id, settings)}`);
  if (shelfAtArrival < settings.minShelfForTransfer) tViol.push(`Shelf life at arrival ${shelfAtArrival.toFixed(1)}d < min ${settings.minShelfForTransfer}d`);
  if (unsold > settings.maxTransferCapacity && tQty === settings.maxTransferCapacity) tViol.length === 0 && null;
  const tCost = tQty * settings.transferCostPerUnit;
  const tWaste = unsold - tQty;
  proposals.push({
    id: "transfer", agent: "transfer", action: "transfer", feasible: tViol.length === 0 && tQty > 0, violations: tViol,
    projectedWaste: tWaste, projectedMargin: (a.sellable + tQty) * (p.price - p.unitCost) - wasteVal(tWaste) - tCost,
    cost: tCost, availability: 100,
    note: `Move ${tQty} units to ${storeName(t.s.id, settings)} (${t.r.hours}h, shortage ${Math.max(0, t.short)}).`,
  });

  // Reduce order
  proposals.push({
    id: "reduce_order", agent: "replenishment", action: "reduce_order", feasible: unsold > 0, violations: unsold > 0 ? [] : ["No surplus to offset"],
    projectedWaste: Math.round(unsold * 0.6), projectedMargin: baseMargin + wasteVal(unsold * 0.4),
    cost: 0, availability: 97,
    note: "Postpones next inbound; relieves future surplus, limited effect on current batch.",
  });

  // Donation
  const partner = PARTNERS.find((d) => d.categories.includes(p.category) && b.expiryDay >= Math.max(d.acceptsMinShelfDays, settings.minShelfForDonation));
  const dViol: string[] = [];
  if (!settings.donationEnabled) dViol.push("Donation disabled in settings");
  if (!p.donatable) dViol.push("Product not eligible (food-safety rule)");
  if (!partner) dViol.push("No partner can receive within shelf-life window");
  const dQty = partner ? Math.min(unsold, partner.capacity) : 0;
  proposals.push({
    id: "donate", agent: "rescue", action: "donate", feasible: dViol.length === 0 && dQty > 0, violations: dViol,
    projectedWaste: unsold - dQty, projectedMargin: baseMargin + wasteVal(0) , cost: dQty * 1,
    availability: 100, note: partner ? `Offer ${dQty} units to ${partner.name} (fictional partner).` : "No eligible partner.",
  });

  // Coordinator objective: margin minus waste penalty (1.5x unit cost per wasted unit)
  const objective = (x: AgentProposal) => x.projectedMargin - x.projectedWaste * p.unitCost * 1.5 - x.cost * 0.2;
  const feasible = proposals.filter((x) => x.feasible);
  const best = feasible.reduce((m, x) => (objective(x) > objective(m) ? x : m), feasible[0]);
  const rationale =
    best.action === "no_action"
      ? "Current demand clears the batch; intervening would cost margin without reducing waste."
      : `${ACTION_LABEL[best.action]} gives the best margin-minus-waste-penalty score among ${feasible.length} feasible options (waste ${best.projectedWaste} units vs ${unsold} baseline).`;
  return { proposals, best, rationale, transferTarget: t.s.id as StoreId, tQty, disc, partner, dQty };
}

let recCounter = 100;
export function buildRecommendation(a: BatchAnalysis, batches: InventoryBatch[], settings: Settings, createdAt: string): Recommendation {
  const ev = evaluateBatch(a, batches, settings);
  const best = ev.best;
  const qty =
    best.action === "transfer" ? ev.tQty : best.action === "donate" ? ev.dQty : best.action === "markdown" ? a.batch.quantity : a.unsold;
  const baselineWaste = a.unsold;
  return {
    id: `R-${recCounter++}`,
    batchId: a.batch.id,
    productId: a.product.id,
    storeId: a.batch.storeId,
    action: best.action,
    targetStoreId: best.action === "transfer" ? ev.transferTarget : undefined,
    partnerId: best.action === "donate" ? ev.partner?.id : undefined,
    discountPct: best.action === "markdown" ? ev.disc : undefined,
    quantity: qty,
    timing: a.batch.expiryDay <= 1 ? "Today, before 12:00" : a.batch.expiryDay <= 3 ? "Within 24 hours" : "Within 48 hours",
    confidence: Math.min(0.94, 0.6 + a.score / 300),
    evidence: [
      a.explanation,
      `Risk score ${a.score}/100 (simulated estimate).`,
      `Expiry in ${a.batch.expiryDay} day(s).`,
    ],
    financialImpact: Math.round(best.projectedMargin - ev.proposals[0].projectedMargin),
    wasteImpact: baselineWaste - best.projectedWaste,
    risks: best.action === "markdown" ? ["May cannibalise full-price sales"] : best.action === "transfer" ? ["Cold-chain handling during transport"] : best.action === "donate" ? ["Partner pickup must occur on schedule"] : ["Forecast error could leave residual waste"],
    status: "pending",
    createdAt,
    agent: best.agent,
    decision: { selected: best.action, rationale: ev.rationale, proposals: ev.proposals },
  };
}

export function buildReplenishRec(productId: string, storeId: StoreId, short: number, createdAt: string): Recommendation {
  const p = product(productId);
  return {
    id: `R-${recCounter++}`,
    batchId: "—",
    productId, storeId, action: "replenish", quantity: short, timing: "Next delivery window (06:00)",
    confidence: 0.78,
    evidence: [`Forecast demand exceeds stock + safety level by ${short} units over the horizon.`, "Demand Agent projects elevated weekday demand."],
    financialImpact: Math.round(short * (p.price - p.unitCost)),
    wasteImpact: 0,
    risks: ["Over-ordering if demand forecast is too high"],
    status: "pending", createdAt, agent: "replenishment",
    decision: {
      selected: "replenish",
      rationale: "Shortage cannot be covered by transfer without depleting another store's safety stock.",
      proposals: [
        { id: "no_action", agent: "demand", action: "no_action", feasible: true, violations: [], projectedWaste: 0, projectedMargin: 0, cost: 0, availability: 82, note: "Stockout likely." },
        { id: "replenish", agent: "replenishment", action: "replenish", feasible: true, violations: [], projectedWaste: 0, projectedMargin: short * (p.price - p.unitCost), cost: short * p.unitCost, availability: 99, note: `Order ${short} units.` },
      ],
    },
  };
}
