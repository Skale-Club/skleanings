import { UsersSection } from "@/pages/admin/UsersSection";
import { PendingInvitationsSection } from "@/components/admin/PendingInvitationsSection";

export function UnifiedUsersSection() {
  return (
    <div className="space-y-6">
      <UsersSection />
      <PendingInvitationsSection />
    </div>
  );
}
