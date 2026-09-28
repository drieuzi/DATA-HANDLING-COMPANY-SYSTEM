import { apiRequest } from "./apiClient.js";

export async function listAuditLogs(limit = 100) {
  return (await apiRequest(`/audit-logs?limit=${limit}`)).auditLogs;
}

export async function recordReportExport(details) {
  return apiRequest("/audit-logs/report-export", {
    method: "POST",
    body: JSON.stringify(details)
  });
}
