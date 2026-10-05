import { USE_DEMO_DATA } from "./authApi.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const DEMO_KEY = "illuminux-demo-users";

const demoAdmin = {
  id: "demo-admin",
  username: "admin",
  fullName: "System Administrator",
  role: "admin",
  isPrimaryAdmin: true,
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
      isPrimaryAdmin: false,
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

export async function listUserDeletionRequests() {
  if (USE_DEMO_DATA) return [];
  return (await request("/admin/user-deletion-requests")).requests;
}

export async function deactivateUser(id, reason) {
  if (USE_DEMO_DATA) {
    let updated;
    saveDemoUsers(getDemoUsers().map((item) => {
      if (String(item.id) !== String(id)) return item;
      updated = {
        ...item, isActive: false, deletedAt: new Date().toISOString(),
        deletionReason: reason, restoreAllowed: true
      };
      return updated;
    }));
    return { user: updated, message: "Demo account deactivated." };
  }
  return request(`/admin/users/${id}/deactivate`, {
    method: "POST",
    body: JSON.stringify({ confirmation: "DELETE", reason })
  });
}

export async function requestAdminDeletion(id, reason) {
  if (USE_DEMO_DATA) return { message: "Demo Admin deletion request recorded." };
  return request(`/admin/users/${id}/deletion-request`, {
    method: "POST",
    body: JSON.stringify({ confirmation: "REQUEST", reason })
  });
}

export async function reviewAdminDeletion(requestId, decision) {
  if (USE_DEMO_DATA) return { message: `Demo request ${decision}.` };
  return request(`/admin/user-deletion-requests/${requestId}/${decision}`, {
    method: "POST",
    body: JSON.stringify({ confirmation: decision === "approve" ? "APPROVE" : "REJECT" })
  });
}

export async function restoreUser(id) {
  if (USE_DEMO_DATA) {
    let updated;
    saveDemoUsers(getDemoUsers().map((item) => {
      if (String(item.id) !== String(id)) return item;
      updated = {
        ...item, isActive: true, deletedAt: null,
        deletionReason: null, restoreAllowed: true
      };
      return updated;
    }));
    return { user: updated, message: "Demo account restored." };
  }
  return request(`/admin/users/${id}/restore`, {
    method: "POST",
    body: JSON.stringify({ confirmation: "RESTORE" })
  });
}

export async function permanentlyDeleteUser(id, reason) {
  if (USE_DEMO_DATA) {
    saveDemoUsers(getDemoUsers().filter((item) => String(item.id) !== String(id)));
    return { deletedUserId: String(id), message: "Demo account permanently deleted." };
  }
  return request(`/admin/users/${id}/permanent`, {
    method: "DELETE",
    body: JSON.stringify({ confirmation: "DELETE", reason })
  });
}
