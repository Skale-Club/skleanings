import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersSection } from "@/pages/admin/UsersSection";
import { StaffSection } from "@/components/admin/StaffSection";
import { Users, Users2 } from "lucide-react";

export function UnifiedUsersSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Users</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage platform users and cleaning professionals.
        </p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users2 className="w-4 h-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Admin Accounts
          </TabsTrigger>
        </TabsList>
        <TabsContent value="staff" className="mt-6">
          <StaffSection />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
