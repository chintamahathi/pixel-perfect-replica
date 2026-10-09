import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DEFAULT_SETTINGS, PRODUCTS, STORES, SIM_TODAY, seedBatches, seedSales } from "@/data/seed";
import {
  ACTION_LABEL, analyzeBatches, buildRecommendation, buildReplenishRec, product, shortage, storeName, type BatchAnalysis,
} from "@/services/logic";
import type { Approval, InventoryBatch, Recommendation, SalesRecord, Settings, SimulationResult, StoreId } from "@/types";

const ts = (minsAgo: number) => new Date(SIM_TODAY.getTime() - minsAgo * 60000).toISOString();

function initialRecs(batches: InventoryBatch[], settings: Settings): Recommendation[] {
  const analysis = analyzeBatches(batches, settings).filter((a) => a.level !== "low").sort((a, b) => b.score - a.score).slice(0, 9);
  const recs = analysis.map((a, i) => buildRecommendation(a, batches, settings, ts(10 + i * 17)));
  const shorts: Recommendation[] = [];
  for (const p of PRODUCTS) for (const s of STORES) {
    const sh = shortage(batches, p.id, s.id, settings);
    if (sh > 25 && shorts.length < 3) shorts.push(buildReplenishRec(p.id, s.id, sh, ts(30 + shorts.length * 22)));
  }
  const all = [...recs, ...shorts];
  // A couple of historic decisions for realism
  if (all[5]) all[5] = { ...all[5], status: "approved" };
  if (all[7]) all[7] = { ...all[7], status: "rejected" };
  return all;
}

function seedActivity(recs: Recommendation[]): Approval[] {
  const out: Approval[] = recs.map((r) => ({
    id: `ACT-${r.id}`, timestamp: r.createdAt, kind: "coordinator",
    summary: `Coordinator proposed: ${ACTION_LABEL[r.action]} — ${product(r.productId).name} @ ${storeName(r.storeId)}`,
    previous: "—", updated: "pending", actor: "Coordinator (simulated)", storeId: r.storeId, productId: r.productId, action: r.action, recId: r.id,
  }));
  recs.filter((r) => r.status !== "pending").forEach((r) =>
    out.push({
      id: `ACT-${r.id}-d`, timestamp: ts(2), kind: r.status === "approved" ? "approval" : "rejection",
      summary: `Planner ${r.status} ${r.id}: ${ACTION_LABEL[r.action]}`, previous: "pending", updated: r.status,
      actor: "Maha (Planner)", storeId: r.storeId, productId: r.productId, action: r.action, recId: r.id,
    }),
  );
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

interface Ctx {
  batches: InventoryBatch[];
  sales: SalesRecord[];
  settings: Settings;
  recs: Recommendation[];
  activity: Approval[];
  simulations: SimulationResult[];
  analysis: BatchAnalysis[];
  approve: (id: string) => void;
  reject: (id: string) => void;
  edit: (id: string, patch: Pick<Recommendation, "quantity" | "action" | "timing">) => void;
  createForBatch: (batchId: string) => Recommendation | null;
  saveSimulation: (s: SimulationResult) => void;
  logSimulation: (s: SimulationResult) => void;
  saveSettings: (s: Settings) => void;
  resetDemo: () => void;
  unread: number;
  markRead: () => void;
}

const FreshCtx = createContext<Ctx | null>(null);

export function FreshMindProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [batches, setBatches] = useState<InventoryBatch[]>(() => seedBatches());
  const [sales] = useState<SalesRecord[]>(() => seedSales());
  const [recs, setRecs] = useState<Recommendation[]>(() => initialRecs(seedBatches(), DEFAULT_SETTINGS));
  const [activity, setActivity] = useState<Approval[]>(() => seedActivity(initialRecs(seedBatches(), DEFAULT_SETTINGS)));
  const [simulations, setSimulations] = useState<SimulationResult[]>([]);
  const [unread, setUnread] = useState(5);

  const analysis = useMemo(() => analyzeBatches(batches, settings), [batches, settings]);

  const log = useCallback((a: Omit<Approval, "id" | "timestamp">) => {
    setActivity((x) => [{ ...a, id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() }, ...x]);
    setUnread((u) => u + 1);
  }, []);

  const applyEffect = useCallback((r: Recommendation) => {
    setBatches((bs) => {
      if (r.action === "transfer" && r.targetStoreId) {
        const src = bs.find((b) => b.id === r.batchId);
        if (!src) return bs;
        const q = Math.min(r.quantity, src.quantity);
        return [
          ...bs.map((b) => (b.id === src.id ? { ...b, quantity: b.quantity - q } : b)),
          { ...src, id: `${src.id}-T${r.targetStoreId}`, storeId: r.targetStoreId as StoreId, quantity: q },
        ];
      }
      if (r.action === "donate") {
        return bs.map((b) => (b.id === r.batchId ? { ...b, quantity: Math.max(0, b.quantity - r.quantity) } : b));
      }
      if (r.action === "replenish") {
        const p = product(r.productId);
        return [...bs, { id: `B-NEW-${r.id}`, productId: r.productId, storeId: r.storeId, quantity: r.quantity, receivedDay: 1, expiryDay: 1 + p.shelfLifeDays }];
      }
      return bs;
    });
  }, []);

  const approve = useCallback((id: string) => {
    const r = recs.find((x) => x.id === id);
    if (!r || r.status === "approved" || r.status === "rejected") return;
    setRecs((rs) => rs.map((x) => (x.id === id ? { ...x, status: "approved" } : x)));
    applyEffect(r);
    log({ kind: "approval", summary: `Approved ${id}: ${ACTION_LABEL[r.action]} — ${product(r.productId).name}`, previous: r.status, updated: "approved", actor: "Maha (Planner)", storeId: r.storeId, productId: r.productId, action: r.action, recId: id });
    toast.success(`Approved ${id}`, { description: "Simulated state updated. No real-world action executed." });
  }, [recs, applyEffect, log]);

  const reject = useCallback((id: string) => {
    const r = recs.find((x) => x.id === id);
    if (!r) return;
    setRecs((rs) => rs.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)));
    log({ kind: "rejection", summary: `Rejected ${id}: ${ACTION_LABEL[r.action]} — ${product(r.productId).name}`, previous: r.status, updated: "rejected", actor: "Maha (Planner)", storeId: r.storeId, productId: r.productId, action: r.action, recId: id });
    toast(`Rejected ${id}`, { description: "Kept in decision history." });
  }, [recs, log]);

  const edit = useCallback<Ctx["edit"]>((id, patch) => {
    const r = recs.find((x) => x.id === id);
    if (!r) return;
    setRecs((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch, status: "edited" } : x)));
    log({ kind: "edit", summary: `Edited ${id}`, previous: `${ACTION_LABEL[r.action]} · ${r.quantity} units · ${r.timing}`, updated: `${ACTION_LABEL[patch.action]} · ${patch.quantity} units · ${patch.timing}`, actor: "Maha (Planner)", storeId: r.storeId, productId: r.productId, action: patch.action, recId: id });
    toast.success(`Updated ${id}`, { description: "Awaiting approval." });
  }, [recs, log]);

  const createForBatch = useCallback((batchId: string) => {
    const a = analysis.find((x) => x.batch.id === batchId);
    if (!a) return null;
    const existing = recs.find((r) => r.batchId === batchId && (r.status === "pending" || r.status === "edited"));
    if (existing) { toast("Recommendation already pending", { description: existing.id }); return existing; }
    const rec = buildRecommendation(a, batches, settings, new Date().toISOString());
    setRecs((rs) => [rec, ...rs]);
    log({ kind: "created", summary: `Created ${rec.id}: ${ACTION_LABEL[rec.action]} — ${a.product.name}`, previous: "—", updated: "pending", actor: "Coordinator (simulated)", storeId: rec.storeId, productId: rec.productId, action: rec.action, recId: rec.id });
    toast.success(`Recommendation ${rec.id} created`, { description: ACTION_LABEL[rec.action] });
    return rec;
  }, [analysis, recs, batches, settings, log]);

  const logSimulation = useCallback((s: SimulationResult) => {
    log({ kind: "simulation", summary: `Ran simulation ${s.id}: ${s.name}`, previous: "baseline state", updated: `Agentic waste ${s.outcomes[2].wasteUnits}u, service ${s.outcomes[2].serviceLevel}%`, actor: "CrisisArena (simulated)" });
  }, [log]);

  const saveSimulation = useCallback((s: SimulationResult) => {
    setSimulations((x) => (x.some((y) => y.id === s.id) ? x : [s, ...x]));
    toast.success(`Saved run ${s.id}`);
  }, []);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    log({ kind: "settings", summary: "Demo settings updated", previous: "previous settings", updated: `High-risk ≥${s.highRiskThreshold}, horizon ${s.forecastHorizon}d`, actor: "Maha (Planner)" });
    toast.success("Settings saved", { description: "Risk scores and recommendations recalculated." });
  }, [log]);

  const resetDemo = useCallback(() => {
    const b = seedBatches();
    setSettings(DEFAULT_SETTINGS);
    setBatches(b);
    const r = initialRecs(b, DEFAULT_SETTINGS);
    setRecs(r);
    setActivity(seedActivity(r));
    setSimulations([]);
    setUnread(5);
    toast.success("Demo reset to initial synthetic state");
  }, []);

  const value: Ctx = {
    batches, sales, settings, recs, activity, simulations, analysis,
    approve, reject, edit, createForBatch, saveSimulation, logSimulation, saveSettings, resetDemo,
    unread, markRead: () => setUnread(0),
  };
  return <FreshCtx.Provider value={value}>{children}</FreshCtx.Provider>;
}

export function useFreshMind() {
  const c = useContext(FreshCtx);
  if (!c) throw new Error("useFreshMind must be inside FreshMindProvider");
  return c;
}
