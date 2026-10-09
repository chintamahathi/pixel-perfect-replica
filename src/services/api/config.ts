/**
 * API configuration for FreshMind AI.
 * Points to the future Python FastAPI backend (freshmind-backend).
 */
export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env["VITE_API_BASE_URL"]) ||
  "http://127.0.0.1:8000";

export type DataMode = "demo" | "live";

export const DATA_MODE: DataMode = "demo";
