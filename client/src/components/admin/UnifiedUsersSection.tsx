import { UsersSection } from "@/pages/admin/UsersSection";

export function UnifiedUsersSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage platform users and cleaning professionals.
        </p>
      </div>

      <UsersSection />
    </div>
  );
}
