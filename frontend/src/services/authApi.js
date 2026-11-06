const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_DEMO_DATA = import.meta.env.VITE_USE_DEMO_DATA === "true";
const TOKEN_KEY = "illuminux_token";

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

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
      fullName: "Demo Administrator",
      role: "admin",
      isPrimaryAdmin: true,
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
  if (result.token) {
    setStoredToken(result.token);
  }
  return result.user;
}

export async function getCurrentUser() {
  if (USE_DEMO_DATA) {
    const saved = sessionStorage.getItem("illuminux-demo-session");
    return saved ? JSON.parse(saved) : null;
  }

  const token = getStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
    headers
  });
  if (response.status === 401) {
    setStoredToken(null);
    return null;
  }
  const result = await readResponse(response);
  return result.user;
}

export async function logout() {
  if (USE_DEMO_DATA) {
    sessionStorage.removeItem("illuminux-demo-session");
    return;
  }

  const token = getStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  setStoredToken(null);
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers
  });
  if (!response.ok && response.status !== 204) await readResponse(response);
}

export { USE_DEMO_DATA };
