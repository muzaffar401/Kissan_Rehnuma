/**
 * Admin API service — calls the admin-service backend.
 * All endpoints are read-only and require admin JWT.
 */

const getAdminBaseUrl = (): string => {
  // Admin API is always at the same host under /admin-api/admin/ via nginx
  // nginx strips /admin-api/ prefix → admin-service receives /admin/...
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    // Dev mode: go through nginx on port 80
    if (__DEV__) {
      return 'http://localhost/admin-api/admin';
    }
    // Production: same host, /admin-api/ prefix via nginx
    return `${protocol}//${hostname}/admin-api/admin`;
  }
  return 'http://localhost/admin-api/admin';
};

const ADMIN_BASE = getAdminBaseUrl();

let adminToken: string | null = null;
let onAuthChange: (() => void) | null = null;

export function setOnAuthChange(cb: (() => void) | null) {
  onAuthChange = cb;
}

function getToken(): string | null {
  return adminToken;
}

function setToken(token: string) {
  adminToken = token;
  try {
    localStorage.setItem('admin_token', token);
  } catch { /* ignore */ }
}

function loadToken(): string | null {
  if (adminToken) return adminToken;
  try {
    adminToken = localStorage.getItem('admin_token');
  } catch { /* ignore */ }
  return adminToken;
}

function clearToken() {
  adminToken = null;
  try {
    localStorage.removeItem('admin_token');
  } catch { /* ignore */ }
}

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = loadToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${ADMIN_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (onAuthChange) onAuthChange();
    throw new Error('Admin session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Admin API error');
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(username: string, password: string) {
  const res = await fetch(`${ADMIN_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(err.detail || 'Invalid admin credentials');
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export function isAdminLoggedIn(): boolean {
  const token = loadToken();
  if (!token) return false;
  // Check JWT expiry (decode without verification)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      clearToken();
      return false;
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp) {
      // exp is in seconds, Date.now() is in milliseconds
      if (payload.exp * 1000 <= Date.now()) {
        // Token is definitely expired — clear it
        clearToken();
        return false;
      }
    }
    // Token exists and is not expired (or has no expiry) — valid
  } catch {
    // Can't parse token at all — it's garbage, clear it
    clearToken();
    return false;
  }
  return true;
}

export function adminLogout() {
  clearToken();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboard() {
  return adminFetch('/dashboard');
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(skip = 0, limit = 50, search = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (search) params.set('search', search);
  return adminFetch(`/users?${params}`);
}

export async function updateUser(farmerId: number, data: Record<string, string>) {
  return adminFetch(`/users/${farmerId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function toggleUserStatus(farmerId: number, isActive: boolean) {
  return adminFetch(`/users/${farmerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });
}

// ── Crop Scans ────────────────────────────────────────────────────────────────

export async function getCropScans(skip = 0, limit = 50, status = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (status) params.set('status', status);
  return adminFetch(`/crop-scans?${params}`);
}

// ── Animal Scans ──────────────────────────────────────────────────────────────

export async function getAnimalScans(skip = 0, limit = 50, status = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (status) params.set('status', status);
  return adminFetch(`/animal-scans?${params}`);
}

// ── Voice Sessions ────────────────────────────────────────────────────────────

export async function getVoiceSessions(skip = 0, limit = 50, status = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (status) params.set('status', status);
  return adminFetch(`/voice-sessions?${params}`);
}

// ── Complaints ────────────────────────────────────────────────────────────────

export async function getComplaints(skip = 0, limit = 50, status = '', category = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  return adminFetch(`/complaints?${params}`);
}

export async function getComplaintEvents(complaintId: string) {
  return adminFetch(`/complaints/${complaintId}/events`);
}

export async function updateComplaintStatus(complaintId: string, status: string, notes?: string) {
  return adminFetch(`/complaints/${complaintId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes: notes || '' }),
  });
}

export async function getFarmerDetail(farmerId: string) {
  return adminFetch(`/complaints/farmer/${farmerId}`);
}

// ── Conversations ─────────────────────────────────────────────────────────────

export async function getConversations(skip = 0, limit = 50) {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  return adminFetch(`/conversations?${params}`);
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export async function getAuditLog(skip = 0, limit = 50, toolName = '') {
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  if (toolName) params.set('tool_name', toolName);
  return adminFetch(`/audit?${params}`);
}
