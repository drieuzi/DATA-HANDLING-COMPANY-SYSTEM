import { demoDashboardData } from "../data/demoDashboardData.js";
import { normalizeDashboardData } from "../utils/dashboardCalculations.js";
import { apiRequest } from "./apiClient.js";

const USE_DEMO_DATA = import.meta.env.VITE_USE_DEMO_DASHBOARD === "true";

/*
  Expected backend response from GET /api/dashboard?year=2026:

  {
    "totalSales": 0,
    "receivables": 0,
    "payables": 0,
    "monthlyExpenses": [
      {
        "month": "Jan",
        "payables": 0,
        "outsideServices": 0
      }
    ]
  }
*/
export async function getDashboardData(year) {
  if (USE_DEMO_DATA) {
    return {
      data: normalizeDashboardData(demoDashboardData),
      source: "demo"
    };
  }

  const data = normalizeDashboardData(await apiRequest(`/dashboard?year=${year}`));

  return { data, source: "live" };
}
