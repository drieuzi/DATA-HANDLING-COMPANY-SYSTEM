import { apiRequest } from "./apiClient.js";

export async function listOutsideServices() {
  return (await apiRequest("/outside-services")).outsideServices;
}

export async function createOutsideService(values) {
  return (await apiRequest("/outside-services", {
    method: "POST",
    body: JSON.stringify(values)
  })).outsideService;
}

export async function updateOutsideService(id, values) {
  return (await apiRequest(`/outside-services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values)
  })).outsideService;
}

export async function deleteOutsideService(id) {
  return apiRequest(`/outside-services/${id}`, { method: "DELETE" });
}
