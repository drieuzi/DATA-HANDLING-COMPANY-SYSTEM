import { USE_DEMO_DATA } from "./authApi.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const DEMO_KEY = "illuminux-demo-users";

const demoAdmin = {
  id: "demo-admin",
  username: "admin",
  fullName: "System Administrator",
  role: "admin",
  isActive: true,
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString()
};

function getDemoUsers() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY)) || [demoAdmin];
  } catch {
    return [demoAdmin];
  }
}

function saveDemoUsers(users) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(users));
  return users;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "The account request failed.");
  return result;
}

export async function listUsers() {
  if (USE_DEMO_DATA) return getDemoUsers();
  return (await request("/admin/users")).users;
}

export async function createUser(values) {
  if (USE_DEMO_DATA) {
    const users = getDemoUsers();
    if (users.some((item) => item.username.toLowerCase() === values.username.toLowerCase())) {
      throw new Error("That username is already in use.");
    }
    const user = {
      id: `demo-${Date.now()}`,
      username: values.username,
      fullName: values.fullName,
      role: values.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    saveDemoUsers([...users, user]);
    return user;
  }
  return (await request("/admin/users", { method: "POST", body: JSON.stringify(values) })).user;
}

export async function updateUser(id, values) {
  if (USE_DEMO_DATA) {
    let updated;
    saveDemoUsers(getDemoUsers().map((item) => {
      if (String(item.id) !== String(id)) return item;
      updated = { ...item, ...values, updatedAt: new Date().toISOString() };
      return updated;
    }));
    return updated;
  }
  return (await request(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(values)
  })).user;
}

export async function resetUserPassword(id, password) {
  if (USE_DEMO_DATA) return { message: "Demo password reset recorded." };
  return request(`/admin/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password })
  });
}
