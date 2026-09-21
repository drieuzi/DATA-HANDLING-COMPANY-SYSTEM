import { apiRequest } from "./apiClient.js";

export async function listVouchers(includeDeleted = false) {
  const result = await apiRequest(`/vouchers${includeDeleted ? "?includeDeleted=true" : ""}`);
  return (Array.isArray(result.vouchers) ? result.vouchers : []).map((voucher) => ({
    ...voucher,
    status: voucher.status || "Draft",
    amountApplied: Number(voucher.amountApplied || 0)
  }));
}

export async function createVoucher(values) {
  return (await apiRequest("/vouchers", { method: "POST", body: JSON.stringify(values) })).voucher;
}

export async function updateVoucher(id, values) {
  return (await apiRequest(`/vouchers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values)
  })).voucher;
}

export function issueVoucher(id) {
  return apiRequest(`/vouchers/${id}/issue`, { method: "POST" });
}

export function cancelVoucher(id, reason) {
  return apiRequest(`/vouchers/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function deleteVoucher(id, reason) {
  return apiRequest(`/vouchers/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
}

export function restoreVoucher(id) {
  return apiRequest(`/vouchers/${id}/restore`, { method: "PATCH" });
}
