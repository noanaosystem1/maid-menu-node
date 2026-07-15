import { STORAGE_KEYS } from "@/lib/constants";

// VITE_API_URL represents the Node.js backend URL (e.g. http://localhost:8080/api)
const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, { method = "GET", body, useSameOrigin = false } = {}) {
  const adminPassword = sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH_PASSWORD);

  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (adminPassword) {
    headers["X-Admin-Password"] = adminPassword;
    headers["Authorization"] = adminPassword;
  }

  // If useSameOrigin is true, make the request to the current host (Cloudflare Worker auth proxy)
  const baseUrl = useSameOrigin ? "/api" : API_BASE;
  const url = useSameOrigin ? path : `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(`API ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  admin: {
    login: (password) => request("/admin/login", { method: "POST", body: { password }, useSameOrigin: false }),
  },
  rooms: {
    list: () => request("/rooms"),
    get: (id) => request(`/rooms/${id}`),
    create: (data) => request("/rooms", { method: "POST", body: data }),
    update: (id, data) => request(`/rooms/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/rooms/${id}`, { method: "DELETE" }),
  },
  guests: {
    list: (params = {}) => {
      const q = new URLSearchParams();
      if (params.roomId) q.set("roomId", params.roomId);
      if (params.sessionToken) q.set("sessionToken", params.sessionToken);
      const qs = q.toString();
      return request(`/guests${qs ? `?${qs}` : ""}`);
    },
    create: (data) => request("/guests", { method: "POST", body: data }),
    update: (id, data) => request(`/guests/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/guests/${id}`, { method: "DELETE" }),
  },
  menuItems: {
    list: (limit = 100) => request(`/menu-items?limit=${limit}`),
    create: (data) => request("/menu-items", { method: "POST", body: data }),
    update: (id, data) => request(`/menu-items/${id}`, { method: "PATCH", body: data }),
    delete: (id) => request(`/menu-items/${id}`, { method: "DELETE" }),
  },
};
