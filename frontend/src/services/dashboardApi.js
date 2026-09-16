import { demoDashboardData } from "../data/demoDashboardData.js";
import { normalizeDashboardData } from "../utils/dashboardCalculations.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_DEMO_DATA = import.meta.env.VITE_USE_DEMO_DATA !== "false";

/*
  Expected backend response from GET /api/dashboard?year=2026:

  {
    "totalSales": 0,
    "receivables": 0,
    "payables": 0,
    "chequeTotal": 0,
    "monthlyExpenses": [
      {
        "month": "Jan",
        "companyTransactions": 0,
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

  const response = await fetch(`${API_BASE_URL}/dashboard?year=${year}`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to load dashboard information from the server.");
  }

  const data = normalizeDashboardData(await response.json());

  return { data, source: "live" };
}
