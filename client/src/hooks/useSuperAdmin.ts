import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// =============================================================================
// Types
// =============================================================================

interface SuperAdminAuthResponse {
  authenticated: boolean;
}

interface SuperAdminStats {
  totalBookings: number;
  totalContacts: number;
  totalServices: number;
  totalStaff: number;
  serverUptimeSeconds: number;
}

interface SuperAdminHealth {
  dbConnected: boolean;
  migrationCount: number;
  envErrors: string[];
  envWarnings: string[];
}

interface ErrorEntry {
  timestamp: string;
  message: string;
  stack?: string;
}

interface CompanySettingsPartial {
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  [key: string]: unknown;
}

// =============================================================================
// Helpers
// =============================================================================

async function superAdminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = res.statusText || "Request failed";
    try {
      const data = text ? JSON.parse(text) : null;
      if (data?.message) message = data.message;
    } catch {
      if (text) message = text;
    }
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

// =============================================================================
// useSuperAdminAuth — GET /api/super-admin/me
// =============================================================================

export function useSuperAdminAuth() {
  return useQuery<SuperAdminAuthResponse>({
    queryKey: ["/api/super-admin/me"],
    queryFn: () => superAdminFetch<SuperAdminAuthResponse>("/api/super-admin/me"),
    retry: false,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// =============================================================================
// useSuperAdminLogin — POST /api/super-admin/login
// =============================================================================

export function useSuperAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) =>
      superAdminFetch<{ ok: boolean }>("/api/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/me"] });
    },
  });
}

// =============================================================================
// useSuperAdminLogout — POST /api/super-admin/logout
// =============================================================================

export function useSuperAdminLogout() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, void>({
    mutationFn: () =>
      superAdminFetch<{ ok: boolean }>("/api/super-admin/logout", {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/me"] });
    },
  });
}

// =============================================================================
// useSuperAdminStats — GET /api/super-admin/stats
// =============================================================================

export function useSuperAdminStats(enabled: boolean) {
  return useQuery<SuperAdminStats>({
    queryKey: ["/api/super-admin/stats"],
    queryFn: () => superAdminFetch<SuperAdminStats>("/api/super-admin/stats"),
    enabled,
    retry: false,
  });
}

// =============================================================================
// useSuperAdminHealth — GET /api/super-admin/health
// =============================================================================

export function useSuperAdminHealth(enabled: boolean) {
  return useQuery<SuperAdminHealth>({
    queryKey: ["/api/super-admin/health"],
    queryFn: () => superAdminFetch<SuperAdminHealth>("/api/super-admin/health"),
    enabled,
    retry: false,
  });
}

// =============================================================================
// useSuperAdminErrorLogs — GET /api/super-admin/error-logs
// =============================================================================

export function useSuperAdminErrorLogs(enabled: boolean) {
  return useQuery<ErrorEntry[]>({
    queryKey: ["/api/super-admin/error-logs"],
    queryFn: () => superAdminFetch<ErrorEntry[]>("/api/super-admin/error-logs"),
    enabled,
    retry: false,
  });
}

// =============================================================================
// useSuperAdminSettings — GET + PATCH /api/super-admin/company-settings
// =============================================================================

export function useSuperAdminSettings(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery<CompanySettingsPartial>({
    queryKey: ["/api/super-admin/company-settings"],
    queryFn: () => superAdminFetch<CompanySettingsPartial>("/api/super-admin/company-settings"),
    enabled,
    retry: false,
  });

  const mutation = useMutation<CompanySettingsPartial, Error, CompanySettingsPartial>({
    mutationFn: (data) =>
      superAdminFetch<CompanySettingsPartial>("/api/super-admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/company-settings"] });
    },
  });

  return { query, mutation };
}

// =============================================================================
// Tenant/Domain types (Phase 42)
// =============================================================================

export interface TenantListItem {
  id: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  primaryDomain: string | null;
  bookingCount: number;
  serviceCount: number;
  staffCount: number;
  // Phase 49: billing columns (null when no subscription row exists)
  billingStatus: string | null;
  billingPlanId: string | null;
  billingCurrentPeriodEnd: string | null;
  planTier: string | null; // Phase 60 — "basic" | "pro" | "enterprise" | null when no sub row
}

export interface DomainRow {
  id: number;
  tenantId: number;
  hostname: string;
  isPrimary: boolean;
  verified: boolean;                // Phase 62 — CD-09
  verifiedAt: string | null;        // Phase 62 — CD-09 (ISO timestamp or null)
  createdAt: string;
}

// =============================================================================
// useSuperAdminTenants — GET /api/super-admin/tenants + mutations
// =============================================================================

export function useSuperAdminTenants(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery<TenantListItem[]>({
    queryKey: ["/api/super-admin/tenants"],
    queryFn: () => superAdminFetch<TenantListItem[]>("/api/super-admin/tenants"),
    enabled,
    retry: false,
  });

  const createTenant = useMutation<
    TenantListItem,
    Error,
    { name: string; slug: string; primaryDomain: string }
  >({
    mutationFn: (data) =>
      superAdminFetch<TenantListItem>("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
  });

  const toggleStatus = useMutation<
    TenantListItem,
    Error,
    { id: number; status: string }
  >({
    mutationFn: ({ id, status }) =>
      superAdminFetch<TenantListItem>(`/api/super-admin/tenants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
  });

  return { query, createTenant, toggleStatus };
}

// =============================================================================
// useUpdateTenantPlan — PATCH /api/super-admin/tenants/:id/plan (Phase 60, PT-07)
// =============================================================================

export function useUpdateTenantPlan() {
  const queryClient = useQueryClient();
  return useMutation<
    { message: string; planTier: string; subscription: unknown },
    Error,
    { tenantId: number; planTier: string }
  >({
    mutationFn: ({ tenantId, planTier }) =>
      superAdminFetch<{ message: string; planTier: string; subscription: unknown }>(
        `/api/super-admin/tenants/${tenantId}/plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planTier }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
  });
}

// =============================================================================
// useSuperAdminTenantDomains — GET + POST + DELETE domains per tenant
// =============================================================================

export function useSuperAdminTenantDomains(tenantId: number | null, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery<DomainRow[]>({
    queryKey: ["/api/super-admin/tenants", tenantId, "domains"],
    queryFn: () =>
      superAdminFetch<DomainRow[]>(`/api/super-admin/tenants/${tenantId}/domains`),
    enabled: enabled && tenantId !== null,
    retry: false,
  });

  const addDomain = useMutation<DomainRow, Error, { hostname: string }>({
    mutationFn: ({ hostname }) =>
      superAdminFetch<DomainRow>(`/api/super-admin/tenants/${tenantId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/super-admin/tenants", tenantId, "domains"],
      });
    },
  });

  const removeDomain = useMutation<void, Error, number>({
    mutationFn: (domainId) =>
      superAdminFetch<void>(`/api/super-admin/domains/${domainId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/super-admin/tenants", tenantId, "domains"],
      });
    },
  });

  return { query, addDomain, removeDomain };
}

// =============================================================================
// useSuperAdminProvision — POST /api/super-admin/tenants/:id/provision
// =============================================================================

export interface ProvisionResult {
  userId: string;
  email: string;
  password: string; // cleartext — shown once, never persisted
}

export function useSuperAdminProvision(tenantId: number | null) {
  return useMutation<ProvisionResult, Error, { email: string }>({
    mutationFn: ({ email }) =>
      superAdminFetch<ProvisionResult>(
        `/api/super-admin/tenants/${tenantId}/provision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      ),
  });
}
