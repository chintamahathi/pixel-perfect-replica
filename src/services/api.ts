// Future integration contracts. The demo uses local deterministic services
// (services/logic.ts, services/simulation.ts). Swap implementations here later
// for Lovable Cloud (Postgres), a FastAPI forecasting service, OR-Tools optimisation
// or a LangGraph multi-agent orchestrator — without touching the UI.
import type { DemandForecast, InventoryBatch, Recommendation, SimulationResult, SimulationScenario } from "@/types";

export interface InventoryService { listBatches(): Promise<InventoryBatch[]> }
export interface ForecastService { forecast(horizonDays: number): Promise<DemandForecast[]> }
export interface OptimizerService { recommend(batches: InventoryBatch[]): Promise<Recommendation[]> }
export interface SimulationService { run(scenario: SimulationScenario): Promise<SimulationResult> }

export const DATA_MODE = "demo" as const; // "demo" | "live"
