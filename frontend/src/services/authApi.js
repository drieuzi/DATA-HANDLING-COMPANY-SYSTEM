const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_DEMO_DATA = import.meta.env.VITE_USE_DEMO_DATA === "true";

async function readResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "The server could not complete the request.");
  return result;
}

export async function login(credentials) {
  if (USE_DEMO_DATA) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    return {
      id: "demo-user",
      username: credentials.username,
      role: "admin",
      demo: true
    };
  }

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(credentials)
  });
  const result = await readResponse(response);
  return result.user;
}

export async function getCurrentUser() {
  if (USE_DEMO_DATA) {
    const saved = sessionStorage.getItem("illuminux-demo-session");
    return saved ? JSON.parse(saved) : null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
  if (response.status === 401) return null;
  const result = await readResponse(response);
  return result.user;
}

export async function logout() {
  if (USE_DEMO_DATA) {
    sessionStorage.removeItem("illuminux-demo-session");
    return;
  }

  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  if (!response.ok && response.status !== 204) await readResponse(response);
}

export { USE_DEMO_DATA };
