const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const USE_DEMO_DATA = import.meta.env.VITE_USE_DEMO_DATA !== "false";

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

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Incorrect username or password.");
  }

  return result.user;
}
