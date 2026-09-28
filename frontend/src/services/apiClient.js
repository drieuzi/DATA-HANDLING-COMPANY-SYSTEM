const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export async function apiRequest(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    },
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || "The server could not complete the request.");
    error.status = response.status;
    error.details = result.details;
    throw error;
  }
  return result;
}

export async function downloadApiFile(path, fallbackName) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "The file could not be downloaded.");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fallbackName || "purchase-order.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function viewApiFile(path) {
  const previewWindow = window.open("", "_blank");
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "The file could not be opened.");
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    if (previewWindow) previewWindow.location.href = objectUrl;
    else window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    if (previewWindow) previewWindow.close();
    throw error;
  }
}
