import { useState, useEffect } from "react";
import {
  useSuperAdminAuth,
  useSuperAdminLogin,
  useSuperAdminLogout,
  useSuperAdminStats,
  useSuperAdminHealth,
  useSuperAdminErrorLogs,
  useSuperAdminSettings,
} from "@/hooks/useSuperAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
