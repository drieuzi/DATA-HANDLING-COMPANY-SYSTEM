import { apiRequest, downloadApiFile, viewApiFile } from "./apiClient.js";

function serviceFormData(values) {
  const formData = new FormData();
  formData.append("payee", values.payee);
  formData.append("item", values.item);
  formData.append("receiptInvoiceNumber", values.receiptInvoiceNumber);
  formData.append("tinNumber", values.tinNumber);
  formData.append("amount", values.amount);
  formData.append("date", values.date);
  if (values.attachment) formData.append("attachment", values.attachment);
  return formData;
}

export async function listOutsideServices(includeDeleted = false) {
  return (await apiRequest(`/outside-services${includeDeleted ? "?includeDeleted=true" : ""}`)).outsideServices;
}

export async function createOutsideService(values) {
  return (await apiRequest("/outside-services", {
    method: "POST",
    body: serviceFormData(values)
  })).outsideService;
}

export async function updateOutsideService(id, values) {
  return (await apiRequest(`/outside-services/${id}`, {
    method: "PATCH",
    body: serviceFormData(values)
  })).outsideService;
}

export async function deleteOutsideService(id, reason) {
  return apiRequest(`/outside-services/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason })
  });
}

export function restoreOutsideService(id) {
  return apiRequest(`/outside-services/${id}/restore`, { method: "PATCH" });
}

export function permanentlyDeleteOutsideService(id, values) {
  return apiRequest(`/outside-services/${id}/permanent`, {
    method: "DELETE",
    body: JSON.stringify(values)
  });
}

export async function replaceOutsideServiceAttachment(id, attachment) {
  const formData = new FormData();
  formData.append("attachment", attachment);
  return (await apiRequest(`/outside-services/${id}/attachment`, {
    method: "PUT",
    body: formData
  })).outsideService;
}

export async function removeOutsideServiceAttachment(id) {
  return (await apiRequest(`/outside-services/${id}/attachment`, {
    method: "DELETE"
  })).outsideService;
}

export function viewOutsideServiceAttachment(id) {
  return viewApiFile(`/outside-services/${id}/attachment`);
}

export function downloadOutsideServiceAttachment(id, filename) {
  return downloadApiFile(`/outside-services/${id}/attachment?download=1`, filename);
}
