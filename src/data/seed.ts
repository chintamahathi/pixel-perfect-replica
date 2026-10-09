// SYNTHETIC DEMO DATA — all values are fictional and generated deterministically.
import type { DonationPartner, InventoryBatch, Product, SalesRecord, Settings, Store, StoreId } from "@/types";

export const SIM_TODAY = new Date("2026-10-09T09:00:00");
export const NETWORK_NAME = "Hyderabad Demo Network";

export const STORES: Store[] = [
  { id: "A", name: "Store A — Central Market", short: "Central Market", capacity: 4200, coldCapacity: 900 },
  { id: "B", name: "Store B — Tech Park", short: "Tech Park", capacity: 3200, coldCapacity: 700 },
  { id: "C", name: "Store C — Lakeview", short: "Lakeview", capacity: 2800, coldCapacity: 600 },
];

export const PRODUCTS: Product[] = [
  { id: "p1", sku: "DRY-MLK-1L", name: "Toned Milk 1L", category: "Dairy", unitCost: 48, price: 62, shelfLifeDays: 5, minStock: 60, donatable: true },
  { id: "p2", sku: "DRY-CRD-400", name: "Fresh Curd 400g", category: "Dairy", unitCost: 32, price: 45, shelfLifeDays: 7, minStock: 40, donatable: true },
  { id: "p3", sku: "DRY-PNR-200", name: "Paneer 200g", category: "Dairy", unitCost: 70, price: 95, shelfLifeDays: 6, minStock: 25, donatable: false },
  { id: "p4", sku: "BKY-BRD-WW", name: "Whole Wheat Bread", category: "Bakery", unitCost: 30, price: 45, shelfLifeDays: 4, minStock: 35, donatable: true },
  { id: "p5", sku: "BKY-BUN-6", name: "Milk Buns (6)", category: "Bakery", unitCost: 22, price: 35, shelfLifeDays: 3, minStock: 25, donatable: true },
  { id: "p6", sku: "BKY-CRS-4", name: "Butter Croissant (4)", category: "Bakery", unitCost: 80, price: 120, shelfLifeDays: 3, minStock: 15, donatable: true },
  { id: "p7", sku: "FRT-BAN-DZ", name: "Robusta Bananas (dozen)", category: "Fruits", unitCost: 40, price: 60, shelfLifeDays: 5, minStock: 40, donatable: true },
  { id: "p8", sku: "FRT-APL-1K", name: "Shimla Apples 1kg", category: "Fruits", unitCost: 120, price: 170, shelfLifeDays: 14, minStock: 30, donatable: true },
  { id: "p9", sku: "FRT-PAP-1", name: "Papaya (each)", category: "Fruits", unitCost: 35, price: 55, shelfLifeDays: 4, minStock: 20, donatable: true },
  { id: "p10", sku: "VEG-TOM-1K", name: "Tomatoes 1kg", category: "Vegetables", unitCost: 28, price: 40, shelfLifeDays: 6, minStock: 50, donatable: true },
  { id: "p11", sku: "VEG-SPN-BN", name: "Spinach Bunch", category: "Vegetables", unitCost: 15, price: 25, shelfLifeDays: 3, minStock: 40, donatable: true },
  { id: "p12", sku: "VEG-CAP-500", name: "Capsicum 500g", category: "Vegetables", unitCost: 38, price: 55, shelfLifeDays: 8, minStock: 25, donatable: true },
];

// Base daily demand per product, multiplied per store
const BASE_DEMAND: Record<string, number> = {
  p1: 42, p2: 26, p3: 14, p4: 22, p5: 16, p6: 8, p7: 24, p8: 12, p9: 10, p10: 30, p11: 20, p12: 12,
};
export const STORE_DEMAND_FACTOR: Record<StoreId, number> = { A: 1.15, B: 1.0, C: 0.75 };

export function baseDemand(productId: string, storeId: StoreId) {
  return Math.round(BASE_DEMAND[productId] * STORE_DEMAND_FACTOR[storeId]);
}

// Deterministic PRNG
function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Explicit batch plan: [productId, storeId, qty, expiryDay]
const BATCH_PLAN: [string, StoreId, number, number][] = [
  ["p1", "A", 180, 1], ["p1", "A", 120, 4], ["p1", "B", 70, 3], ["p1", "C", 110, 2],
  ["p2", "A", 60, 5], ["p2", "B", 30, 2], ["p2", "C", 75, 3],
  ["p3", "A", 40, 4], ["p3", "B", 8, 5], ["p3", "C", 30, 2],
  ["p4", "A", 140, 1], ["p4", "B", 40, 2], ["p4", "C", 30, 3],
  ["p5", "A", 60, 1], ["p5", "B", 20, 2], ["p5", "C", 35, 1],
  ["p6", "A", 30, 1], ["p6", "B", 6, 2], ["p6", "C", 12, 2],
  ["p7", "A", 90, 3], ["p7", "B", 40, 2], ["p7", "C", 70, 2],
  ["p8", "A", 80, 11], ["p8", "B", 60, 9], ["p8", "C", 25, 12],
  ["p9", "A", 30, 2], ["p9", "B", 10, 3], ["p9", "C", 28, 1],
  ["p10", "A", 110, 4], ["p10", "B", 25, 3], ["p10", "C", 60, 2],
  ["p11", "A", 70, 1], ["p11", "B", 30, 2], ["p11", "C", 45, 1],
  ["p12", "A", 40, 6], ["p12", "B", 15, 5], ["p12", "C", 35, 7],
];

export function seedBatches(): InventoryBatch[] {
  const counter: Record<string, number> = {};
  return BATCH_PLAN.map(([productId, storeId, quantity, expiryDay]) => {
    const p = PRODUCTS.find((x) => x.id === productId)!;
    const key = `${productId}${storeId}`;
    counter[key] = (counter[key] ?? 0) + 1;
    return {
      id: `B-${p.sku.split("-")[1]}${storeId}${String(counter[key]).padStart(2, "0")}`,
      productId,
      storeId,
      quantity,
      expiryDay,
      receivedDay: expiryDay - p.shelfLifeDays,
    };
  });
}

export function seedSales(): SalesRecord[] {
  const rnd = mulberry(42);
  const out: SalesRecord[] = [];
  for (let day = -13; day <= 0; day++) {
    const weekend = ((day % 7) + 7) % 7 >= 5 ? 1.18 : 1;
    for (const p of PRODUCTS) {
      for (const s of STORES) {
        const base = baseDemand(p.id, s.id) * weekend;
        const forecast = Math.round(base * (0.95 + rnd() * 0.1));
        const units = Math.max(0, Math.round(base * (0.82 + rnd() * 0.32)));
        out.push({ day, productId: p.id, storeId: s.id, units, forecast });
      }
    }
  }
  return out;
}

export const PARTNERS: DonationPartner[] = [
  { id: "d1", name: "Community Food Hub", categories: ["Bakery", "Fruits", "Vegetables"], capacity: 150, pickup: "Daily 17:00–19:00", travelMins: 25, acceptsMinShelfDays: 1 },
  { id: "d2", name: "City Relief Kitchen", categories: ["Dairy", "Vegetables", "Bakery"], capacity: 90, pickup: "Mon–Sat 10:00–12:00", travelMins: 40, acceptsMinShelfDays: 2 },
  { id: "d3", name: "Local Food Rescue Centre", categories: ["Fruits", "Vegetables", "Dairy", "Bakery"], capacity: 200, pickup: "On request (4h notice)", travelMins: 55, acceptsMinShelfDays: 2 },
];

// Travel time (hours) and cost multiplier between stores
export const ROUTES: { from: StoreId; to: StoreId; km: number; hours: number }[] = [
  { from: "A", to: "B", km: 14, hours: 1.2 },
  { from: "A", to: "C", km: 9, hours: 0.8 },
  { from: "B", to: "C", km: 18, hours: 1.6 },
];

export function route(a: StoreId, b: StoreId) {
  return ROUTES.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a))!;
}

export const DEFAULT_SETTINGS: Settings = {
  storeNames: { A: "Central Market", B: "Tech Park", C: "Lakeview" },
  storeCapacity: { A: 4200, B: 3200, C: 2800 },
  categories: ["Dairy", "Bakery", "Fruits", "Vegetables"],
  highRiskThreshold: 65,
  mediumRiskThreshold: 35,
  maxMarkdownPct: 40,
  minStockMultiplier: 1,
  transferCostPerUnit: 3,
  maxTransferCapacity: 120,
  minShelfForTransfer: 1,
  minShelfForDonation: 1,
  donationEnabled: true,
  forecastHorizon: 3,
};
