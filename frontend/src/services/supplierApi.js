import { apiRequest } from "./apiClient.js";

export async function listSuppliers(includeDeleted = false) {
  const result = await apiRequest(`/suppliers${includeDeleted ? "?includeDeleted=true" : ""}`);
  return result.suppliers;
}

export async function createSupplier(values) {
  return (await apiRequest("/suppliers", { method: "POST", body: JSON.stringify(values) })).supplier;
}

export async function updateSupplier(id, values) {
  return (await apiRequest(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(values) })).supplier;
}

export function deleteSupplier(id, reason) {
  return apiRequest(`/suppliers/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
}

export function restoreSupplier(id) {
  return apiRequest(`/suppliers/${id}/restore`, { method: "PATCH" });
}

export async function createSupplierTransaction(supplierId, values) {
  return (await apiRequest("/suppliers/transactions", {
    method: "POST", body: JSON.stringify({ ...values, supplierId })
  })).transaction;
}

export async function updateSupplierTransaction(id, values) {
  return (await apiRequest(`/suppliers/transactions/${id}`, {
    method: "PATCH", body: JSON.stringify(values)
  })).transaction;
}

export function deleteSupplierTransaction(id, reason) {
  return apiRequest(`/suppliers/transactions/${id}`, {
    method: "DELETE", body: JSON.stringify({ reason })
  });
}

export function restoreSupplierTransaction(id) {
  return apiRequest(`/suppliers/transactions/${id}/restore`, { method: "PATCH" });
}
