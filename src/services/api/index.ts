/**
 * FreshMind AI - Clean Frontend API Integration Layer
 *
 * Prepared for future integration with the Python FastAPI backend (freshmind-backend).
 * All UI state and features currently operate in standalone local demo mode.
 */
import type {
  DemandForecast,
  InventoryBatch,
  Recommendation,
  SimulationResult,
  SimulationScenario,
} from "@/types";

export * from "./config";
export * from "./client";

export interface InventoryService {
  listBatches(): Promise<InventoryBatch[]>;
  updateBatch(id: string, patch: Partial<InventoryBatch>): Promise<InventoryBatch>;
}

export interface ForecastService {
  forecast(horizonDays: number): Promise<DemandForecast[]>;
}

export interface OptimizerService {
  recommend(batches: InventoryBatch[]): Promise<Recommendation[]>;
  approveRecommendation(id: string): Promise<void>;
  rejectRecommendation(id: string): Promise<void>;
}

export interface SimulationService {
  run(scenario: SimulationScenario): Promise<SimulationResult>;
}
