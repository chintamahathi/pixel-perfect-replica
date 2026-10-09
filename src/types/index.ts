export type StoreId = "A" | "B" | "C";
export type Category = "Dairy" | "Bakery" | "Fruits" | "Vegetables";
export type RiskLevel = "low" | "medium" | "high";

export interface Store {
  id: StoreId;
  name: string;
  short: string;
  capacity: number;
  coldCapacity: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: Category;
  unitCost: number;
  price: number;
  shelfLifeDays: number;
  minStock: number;
  donatable: boolean;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  storeId: StoreId;
  quantity: number;
  receivedDay: number; // day offset (0 = today)
  expiryDay: number; // day offset from today
}

export interface SalesRecord {
  day: number; // negative = past
  productId: string;
  storeId: StoreId;
  units: number;
  forecast: number;
}

export interface DemandForecast {
  productId: string;
  storeId: StoreId;
  dailyDemand: number;
  horizonDemand: number;
}

export type AgentId = "demand" | "freshness" | "replenishment" | "markdown" | "transfer" | "rescue";

export type ActionType = "markdown" | "transfer" | "replenish" | "reduce_order" | "donate" | "no_action";

export type RecStatus = "pending" | "approved" | "rejected" | "edited";

export interface AgentProposal {
  id: string;
  agent: AgentId;
  action: ActionType;
  feasible: boolean;
  violations: string[];
  projectedWaste: number;
  projectedMargin: number;
  cost: number;
  availability: number; // % service level
  note: string;
}

export interface CoordinatorDecision {
  selected: ActionType;
  rationale: string;
  proposals: AgentProposal[];
}

export interface Recommendation {
  id: string;
  batchId: string;
  productId: string;
  storeId: StoreId;
  action: ActionType;
  targetStoreId?: StoreId;
  partnerId?: string;
  quantity: number;
  timing: string;
  confidence: number;
  evidence: string[];
  financialImpact: number;
  wasteImpact: number;
  risks: string[];
  status: RecStatus;
  createdAt: string;
  agent: AgentId;
  decision: CoordinatorDecision;
  discountPct?: number;
}

export interface Approval {
  id: string;
  timestamp: string;
  kind: "approval" | "rejection" | "edit" | "simulation" | "coordinator" | "settings" | "created";
  summary: string;
  previous: string;
  updated: string;
  actor: string;
  storeId?: StoreId;
  productId?: string;
  action?: ActionType;
  recId?: string;
}

export interface DonationPartner {
  id: string;
  name: string;
  categories: Category[];
  capacity: number;
  pickup: string;
  travelMins: number;
  acceptsMinShelfDays: number;
}

export type ScenarioKind = "surge" | "drop" | "delay" | "event" | "weather" | "excess";

export interface SimulationScenario {
  kind: ScenarioKind;
  storeId: StoreId | "all";
  category: Category | "all";
  durationDays: number;
  severity: "low" | "medium" | "high";
  demandChangePct: number;
  deliveryDelayDays: number;
  promotionIntensity: number;
  weatherImpactPct: number;
  transferCapacity: number;
  markdownLimitPct: number;
}

export interface StrategyOutcome {
  strategy: "Baseline" | "Optimization-only" | "Agentic";
  wasteUnits: number;
  wasteValue: number;
  stockoutUnits: number;
  serviceLevel: number;
  inventoryCost: number;
  markdownCost: number;
  transferCost: number;
  margin: number;
  violations: number;
}

export interface SimulationResult {
  id: string;
  name: string;
  createdAt: string;
  scenario: SimulationScenario;
  outcomes: StrategyOutcome[];
  computeMs: number;
  before: { storeId: StoreId; healthy: number; atRisk: number; shortage: number }[];
  after: { storeId: StoreId; healthy: number; atRisk: number; shortage: number }[];
  newHighRisk: string[];
  transfers: { product: string; from: StoreId; to: StoreId; qty: number }[];
  markdowns: { product: string; store: StoreId; pct: number; qty: number }[];
  shortagesPrevented: number;
  unresolved: string[];
}

export interface Settings {
  storeNames: Record<StoreId, string>;
  storeCapacity: Record<StoreId, number>;
  categories: Category[];
  highRiskThreshold: number;
  mediumRiskThreshold: number;
  maxMarkdownPct: number;
  minStockMultiplier: number;
  transferCostPerUnit: number;
  maxTransferCapacity: number;
  minShelfForTransfer: number;
  minShelfForDonation: number;
  donationEnabled: boolean;
  forecastHorizon: number;
}
