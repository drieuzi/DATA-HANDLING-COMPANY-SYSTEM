import { apiRequest } from "./apiClient.js";

export async function listAuditLogs(limit = 100) {
  return (await apiRequest(`/audit-logs?limit=${limit}`)).auditLogs;
}
