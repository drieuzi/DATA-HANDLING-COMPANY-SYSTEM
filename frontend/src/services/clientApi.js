import { apiRequest } from "./apiClient.js";

export async function listClients(includeDeleted = false) {
  return (await apiRequest(`/clients${includeDeleted ? "?includeDeleted=true" : ""}`)).clients;
}

export async function createClient(values) {
  return (await apiRequest("/clients", { method: "POST", body: JSON.stringify(values) })).client;
}

export async function updateClient(id, values) {
  return (await apiRequest(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(values) })).client;
}

export function deleteClient(id, reason) {
  return apiRequest(`/clients/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
}

export function restoreClient(id) {
  return apiRequest(`/clients/${id}/restore`, { method: "PATCH" });
}

export function permanentlyDeleteClient(id) {
  return apiRequest(`/clients/${id}/permanent`, { method: "DELETE" });
}

export async function createClientTransaction(clientId, values) {
  return (await apiRequest("/clients/transactions", {
    method: "POST", body: JSON.stringify({ ...values, clientId })
  })).transaction;
}

export async function updateClientTransaction(id, values) {
  return (await apiRequest(`/clients/transactions/${id}`, {
    method: "PATCH", body: JSON.stringify(values)
  })).transaction;
}

export function deleteClientTransaction(id, reason) {
  return apiRequest(`/clients/transactions/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) });
}

export function restoreClientTransaction(id) {
  return apiRequest(`/clients/transactions/${id}/restore`, { method: "PATCH" });
}

export async function recordClientPayment(transactionId, values) {
  return (await apiRequest(`/clients/transactions/${transactionId}/payments`, {
    method: "POST", body: JSON.stringify(values)
  })).transaction;
}

export async function getClientPaymentHistory(transactionId) {
  return (await apiRequest(`/clients/transactions/${transactionId}/payments`)).payments;
}
