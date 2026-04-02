import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authenticatedRequest } from "@/lib/queryClient";

interface CalendarStatus {
  staffMemberId: number;
  firstName: string;
  lastName: string;
  connected: boolean;
  needsReconnect: boolean;
  lastDisconnectedAt: string | null;
}

export function CalendarReconnectBanner({
  getAccessToken,
}: {
  getAccessToken: () => Promise<string | null>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: statuses } = useQuery<CalendarStatus[]>({
    queryKey: ["/api/staff/calendar/all-statuses"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await authenticatedRequest("GET", "/api/staff/calendar/all-statuses", token);
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const disconnected = statuses?.filter((s) => s.needsReconnect) ?? [];

  if (dismissed || disconnected.length === 0) return null;

  return (
    <>
      <div className="mx-6 mt-4 sm:mx-6 md:mx-8 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium">
          Urgent: Calendar / Video Conferencing integrations are disconnected
          &mdash; reconnect now to avoid scheduling disruptions
        </p>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          Fix This
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Take Action
            </DialogTitle>
            <DialogDescription>
              The following integrations need your attention &mdash; reconnect
              now to prevent any interruptions.
            </DialogDescription>
          </DialogHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Integration</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disconnected.map((staff) => (
                <TableRow key={staff.staffMemberId}>
                  <TableCell className="flex items-center gap-2">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span>{staff.firstName} {staff.lastName}</span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/api/staff/${staff.staffMemberId}/calendar/connect`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reconnect
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
