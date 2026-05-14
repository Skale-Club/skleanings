import { useState, useEffect } from "react";
import {
  useSuperAdminAuth,
  useSuperAdminLogin,
  useSuperAdminLogout,
  useSuperAdminStats,
  useSuperAdminHealth,
  useSuperAdminErrorLogs,
  useSuperAdminSettings,
  useSuperAdminTenants,
  useSuperAdminTenantDomains,
  useSuperAdminProvision,
  type TenantListItem,
  type DomainRow,
  type ProvisionResult,
} from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// =============================================================================
// Helpers
// =============================================================================

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

// =============================================================================
// Login form
// =============================================================================

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useSuperAdminLogin();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Super Admin</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Platform Operations</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="sa-email">Email</Label>
              <Input
                id="sa-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sa-password">Password</Label>
              <Input
                id="sa-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>
            {login.isError && (
              <p className="text-sm text-red-600">
                {login.error?.message || "Invalid credentials"}
              </p>
            )}
            <Button
              type="submit"
              disabled={login.isPending}
              className="w-full rounded-full font-bold text-black"
              style={{ backgroundColor: "#FFFF01" }}
            >
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Stat card
// =============================================================================

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ManageDomainsDialog — list + add + remove domains for one tenant
// =============================================================================

function ManageDomainsDialog({ tenant, open, onOpenChange }: {
  tenant: TenantListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [newHostname, setNewHostname] = useState("");
  const { query, addDomain, removeDomain } = useSuperAdminTenantDomains(
    tenant?.id ?? null,
    open && tenant !== null
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    addDomain.mutate(
      { hostname: newHostname.trim() },
      {
        onSuccess: () => setNewHostname(""),
        onError: (err) => alert(err.message),
      }
    );
  }

  function handleRemove(domainId: number) {
    if (!confirm("Remove this domain?")) return;
    removeDomain.mutate(domainId, {
      onError: (err) => alert(err.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Domains — {tenant?.name}</DialogTitle>
          <DialogDescription>
            Add or remove hostnames. The primary domain cannot be removed.
          </DialogDescription>
        </DialogHeader>

        {query.isLoading && <p className="text-sm text-gray-400">Loading domains…</p>}
        {query.isError && <p className="text-sm text-red-500">Failed to load domains</p>}
        {query.data && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Primary</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((d: DomainRow) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">{d.hostname}</TableCell>
                  <TableCell>
                    {d.isPrimary && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">Primary</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={d.isPrimary || removeDomain.isPending}
                      onClick={() => handleRemove(d.id)}
                      className="text-red-600 hover:text-red-800 disabled:opacity-30"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <form onSubmit={handleAdd} className="flex gap-2 mt-2">
          <Input
            placeholder="new-tenant.xkedule.com"
            value={newHostname}
            onChange={(e) => setNewHostname(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={addDomain.isPending || !newHostname.trim()}>
            {addDomain.isPending ? "Adding…" : "Add"}
          </Button>
        </form>
        {addDomain.isError && (
          <p className="text-sm text-red-600">{addDomain.error?.message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// ProvisionDialog — email input → one-time credentials display
// =============================================================================

function ProvisionDialog({ tenantId, open, onOpenChange }: {
  tenantId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const provision = useSuperAdminProvision(tenantId);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    provision.mutate(
      { email: email.trim() },
      {
        onError: (err) => setError(err.message),
      }
    );
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Reset all state when dialog closes — password gone after close
      provision.reset();
      setEmail("");
      setError("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Provision Admin</DialogTitle>
          <DialogDescription>
            Creates a bcrypt-hashed password. The plaintext is shown once — copy it now.
          </DialogDescription>
        </DialogHeader>

        {!provision.data ? (
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label htmlFor="p-email">Admin Email</Label>
              <Input
                id="p-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@tenant.com"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              type="submit"
              disabled={provision.isPending}
              className="w-full rounded-full font-bold text-black"
              style={{ backgroundColor: "#FFFF01" }}
            >
              {provision.isPending ? "Provisioning…" : "Provision"}
            </Button>
          </form>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="text-sm text-gray-600">
              Credentials created. Copy these now — the password will not be shown again.
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label>Email</Label>
                <div className="flex items-center gap-2">
                  <Input value={provision.data.email} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText((provision.data as ProvisionResult).email)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Generated Password</Label>
                <div className="flex items-center gap-2">
                  <Input value={provision.data.password} readOnly className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText((provision.data as ProvisionResult).password)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => handleClose(false)}
              className="w-full rounded-full font-bold text-black"
              style={{ backgroundColor: "#FFFF01" }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// TenantsSection — table with create + manage actions
// =============================================================================

function TenantsSection() {
  const { query, createTenant, toggleStatus } = useSuperAdminTenants(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [domainsTarget, setDomainsTarget] = useState<TenantListItem | null>(null);
  const [provisionTarget, setProvisionTarget] = useState<TenantListItem | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [createError, setCreateError] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    createTenant.mutate(
      { name: newName.trim(), slug: newSlug.trim(), primaryDomain: newDomain.trim() },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewName(""); setNewSlug(""); setNewDomain("");
        },
        onError: (err) => setCreateError(err.message),
      }
    );
  }

  function handleToggle(tenant: TenantListItem) {
    const next = tenant.status === "active" ? "inactive" : "active";
    toggleStatus.mutate(
      { id: tenant.id, status: next },
      { onError: (err) => alert(err.message) }
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Tenants
        </h2>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="rounded-full font-bold text-black"
              style={{ backgroundColor: "#FFFF01" }}
            >
              Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Tenant</DialogTitle>
              <DialogDescription>
                Provide a name, unique slug, and primary hostname.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3 mt-2">
              <div className="space-y-1">
                <Label htmlFor="t-name">Name</Label>
                <Input
                  id="t-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="Acme Cleaning"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-slug">Slug</Label>
                <Input
                  id="t-slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  required
                  placeholder="acme"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="t-domain">Primary Domain</Label>
                <Input
                  id="t-domain"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  required
                  placeholder="acme.xkedule.com"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <Button
                type="submit"
                disabled={createTenant.isPending}
                className="w-full rounded-full font-bold text-black"
                style={{ backgroundColor: "#FFFF01" }}
              >
                {createTenant.isPending ? "Creating…" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {query.isLoading && <p className="text-sm text-gray-400">Loading tenants…</p>}
      {query.isError && <p className="text-sm text-red-500">Failed to load tenants</p>}
      {query.data && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Primary Domain</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Staff</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.map((tenant: TenantListItem) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">{tenant.slug}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          tenant.status === "active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }
                      >
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {tenant.primaryDomain ?? <span className="text-gray-400">—</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {tenant.bookingCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {tenant.serviceCount}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {tenant.staffCount}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDomainsTarget(tenant)}
                        >
                          Domains
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProvisionTarget(tenant)}
                        >
                          Provision Admin
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleStatus.isPending}
                          onClick={() => handleToggle(tenant)}
                        >
                          {tenant.status === "active" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ManageDomainsDialog
        tenant={domainsTarget}
        open={domainsTarget !== null}
        onOpenChange={(open) => { if (!open) setDomainsTarget(null); }}
      />
      <ProvisionDialog
        tenantId={provisionTarget?.id ?? null}
        open={provisionTarget !== null}
        onOpenChange={(open) => { if (!open) setProvisionTarget(null); }}
      />
    </section>
  );
}

// =============================================================================
// Dashboard
// =============================================================================

function Dashboard() {
  const logout = useSuperAdminLogout();
  const stats = useSuperAdminStats(true);
  const health = useSuperAdminHealth(true);
  const errorLogs = useSuperAdminErrorLogs(true);
  const { query: settingsQuery, mutation: settingsMutation } = useSuperAdminSettings(true);

  // Company settings form state
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [saved, setSaved] = useState(false);

  // Pre-fill form when settings load
  useEffect(() => {
    if (settingsQuery.data) {
      setCompanyName((settingsQuery.data.companyName as string) ?? "");
      setCompanyEmail((settingsQuery.data.companyEmail as string) ?? "");
      setCompanyPhone((settingsQuery.data.companyPhone as string) ?? "");
      setCompanyAddress((settingsQuery.data.companyAddress as string) ?? "");
    }
  }, [settingsQuery.data]);

  function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    settingsMutation.mutate(
      { companyName, companyEmail, companyPhone, companyAddress },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Super Admin Panel</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? "Logging out…" : "Logout"}
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        <TenantsSection />

        {/* Section 1 — Stats */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Platform Stats
          </h2>
          {stats.isLoading ? (
            <p className="text-sm text-gray-400">Loading stats…</p>
          ) : stats.isError ? (
            <p className="text-sm text-red-500">Failed to load stats</p>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              <StatCard label="Total Bookings" value={stats.data?.totalBookings ?? "—"} />
              <StatCard label="Total Contacts" value={stats.data?.totalContacts ?? "—"} />
              <StatCard label="Total Services" value={stats.data?.totalServices ?? "—"} />
              <StatCard label="Active Staff" value={stats.data?.totalStaff ?? "—"} />
              <StatCard
                label="Server Uptime"
                value={
                  stats.data?.serverUptimeSeconds != null
                    ? formatUptime(stats.data.serverUptimeSeconds)
                    : "—"
                }
              />
            </div>
          )}
        </section>

        {/* Section 2 — Health */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Health Check
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-3">
              {health.isLoading ? (
                <p className="text-sm text-gray-400">Loading health…</p>
              ) : health.isError ? (
                <p className="text-sm text-red-500">Failed to load health data</p>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40">DB Connected</span>
                    {health.data?.dbConnected ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Connected</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40">Migration Count</span>
                    <span className="text-sm">{health.data?.migrationCount ?? 0}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Env Errors</p>
                    {health.data?.envErrors && health.data.envErrors.length > 0 ? (
                      <ul className="text-sm text-red-600 list-disc list-inside space-y-0.5">
                        {health.data.envErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">None</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Env Warnings</p>
                    {health.data?.envWarnings && health.data.envWarnings.length > 0 ? (
                      <ul className="text-sm text-yellow-600 list-disc list-inside space-y-0.5">
                        {health.data.envWarnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">None</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Section 3 — Company Settings (lean: 4 fields only) */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Company Settings
          </h2>
          <Card>
            <CardContent className="pt-6">
              {settingsQuery.isLoading ? (
                <p className="text-sm text-gray-400">Loading settings…</p>
              ) : (
                <form onSubmit={handleSettingsSave} className="space-y-4 max-w-md">
                  <div className="space-y-1">
                    <Label htmlFor="cs-name">Company Name</Label>
                    <Input
                      id="cs-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Acme Cleaning Co."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cs-email">Email</Label>
                    <Input
                      id="cs-email"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="hello@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cs-phone">Phone</Label>
                    <Input
                      id="cs-phone"
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+1 555 000 0000"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cs-address">Address</Label>
                    <Input
                      id="cs-address"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      placeholder="123 Main St, City, State"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      disabled={settingsMutation.isPending}
                      className="rounded-full font-bold text-black"
                      style={{ backgroundColor: "#FFFF01" }}
                    >
                      {settingsMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    {saved && (
                      <span className="text-sm text-green-600 font-medium">Saved</span>
                    )}
                    {settingsMutation.isError && (
                      <span className="text-sm text-red-600">
                        {settingsMutation.error?.message || "Save failed"}
                      </span>
                    )}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Section 4 — Error Logs */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Error Logs
          </h2>
          <Card>
            <CardContent className="pt-6">
              {errorLogs.isLoading ? (
                <p className="text-sm text-gray-400">Loading logs…</p>
              ) : errorLogs.isError ? (
                <p className="text-sm text-red-500">Failed to load error logs</p>
              ) : !errorLogs.data || errorLogs.data.length === 0 ? (
                <p className="text-sm text-gray-400">No errors recorded</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 font-mono text-xs">
                  {errorLogs.data.map((entry, i) => (
                    <div key={i} className="border-b border-gray-100 pb-2 last:border-0">
                      <p className="text-gray-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                      <p className="text-gray-800 font-medium">{entry.message}</p>
                      {entry.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
                            Stack trace
                          </summary>
                          <pre className="mt-1 text-gray-500 whitespace-pre-wrap break-all text-xs">
                            {entry.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </div>
    </div>
  );
}

// =============================================================================
// SuperAdmin page — root component
// =============================================================================

export default function SuperAdmin() {
  const auth = useSuperAdminAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (auth.data?.authenticated !== true) {
    return <LoginForm />;
  }

  return <Dashboard />;
}
