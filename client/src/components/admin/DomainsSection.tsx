import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Copy, Globe, Loader2, Plus, Trash2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---------------------------------------------------------------------------
// Types — mirror the backend GET/POST shapes for /api/admin/domains
// ---------------------------------------------------------------------------

type DomainItem = {
  id: number;
  hostname: string;
  isPrimary: boolean;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
};

type AddDomainResponse = {
  id: number;
  hostname: string;
  verificationToken: string;
  instructions: {
    recordType: string;
    recordName: string;
    recordValue: string;
    message: string;
  };
};

const DOMAINS_QUERY_KEY = ['/api/admin/domains'] as const;
const BRAND_YELLOW_BTN =
  'bg-[#FFFF01] hover:bg-yellow-300 text-black font-bold rounded-full';

// ---------------------------------------------------------------------------
// Status badge helper — priority: Primary > Verified > Pending
// ---------------------------------------------------------------------------

function StatusBadge({ domain }: { domain: DomainItem }) {
  if (domain.isPrimary) {
    return (
      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
        Primary
      </Badge>
    );
  }
  if (domain.verified) {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Verified
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
      Pending Verification
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Add Domain Dialog — POST then surface DNS instructions; Verify on demand.
// verificationToken is held in component state only — never persisted.
// ---------------------------------------------------------------------------

function AddDomainDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [hostname, setHostname] = useState('');
  const [result, setResult] = useState<AddDomainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const resetAndClose = () => {
    setHostname('');
    setResult(null);
    setError(null);
    setSubmitting(false);
    setVerifying(false);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    const trimmed = hostname.trim().toLowerCase();
    if (!trimmed) {
      setError('Please enter a hostname');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.message || 'Failed to add domain';
        setError(message);
        toast({
          title: 'Could not add domain',
          description: message,
          variant: 'destructive',
        });
        return;
      }
      setResult(data as AddDomainResponse);
      queryClient.invalidateQueries({ queryKey: DOMAINS_QUERY_KEY });
    } catch (err: any) {
      const message = err?.message || 'Network error';
      setError(message);
      toast({
        title: 'Could not add domain',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.verificationToken);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Please copy the value manually.',
        variant: 'destructive',
      });
    }
  };

  const handleVerify = async () => {
    if (!result) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/admin/domains/${result.id}/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.verified) {
        const message =
          data?.message || 'TXT record not found yet — DNS may still be propagating.';
        toast({
          title: 'Verification failed',
          description: message,
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Domain verified!',
        description: result.hostname,
      });
      queryClient.invalidateQueries({ queryKey: DOMAINS_QUERY_KEY });
      resetAndClose();
    } catch (err: any) {
      toast({
        title: 'Verification failed',
        description: err?.message || 'Network error',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {result ? 'Add DNS record to verify' : 'Add Custom Domain'}
          </DialogTitle>
          <DialogDescription>
            {result
              ? 'Add the TXT record below to your DNS provider, then click Verify. You can also verify later from the domain list.'
              : 'Enter your custom hostname (e.g. agendar.minhalimpeza.com). Subdomains of xkedule.com are reserved.'}
          </DialogDescription>
        </DialogHeader>

        {result === null ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="domain-hostname">Hostname</Label>
              <Input
                id="domain-hostname"
                placeholder="agendar.minhalimpeza.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className={BRAND_YELLOW_BTN}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding…
                  </>
                ) : (
                  'Add'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="bg-slate-50 border rounded-md p-4 font-mono text-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Record type:</span>
                <span className="text-slate-900">{result.instructions.recordType}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Name:</span>
                <span className="text-slate-900 truncate" title={result.instructions.recordName}>
                  {result.instructions.recordName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 shrink-0">Value:</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-slate-900 truncate"
                    title={result.verificationToken}
                  >
                    {result.verificationToken}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyToken}
                    aria-label="Copy verification token"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </span>
              </div>
            </div>
            {result.instructions.message && (
              <p className="text-sm text-muted-foreground">
                {result.instructions.message}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose} disabled={verifying}>
                Close
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className={BRAND_YELLOW_BTN}
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying…
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// DomainsSection — the page-level component exported to Admin.tsx
// ---------------------------------------------------------------------------

export function DomainsSection() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DomainItem | null>(null);

  const { data, isLoading } = useQuery<{ domains: DomainItem[] }>({
    queryKey: DOMAINS_QUERY_KEY,
  });

  const verifyMutation = useMutation({
    mutationFn: async (domain: DomainItem) => {
      const res = await fetch(`/api/admin/domains/${domain.id}/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.verified) {
        const message =
          body?.message || 'TXT record not found yet — DNS may still be propagating.';
        throw new Error(message);
      }
      return { domain, body };
    },
    onSuccess: ({ domain }) => {
      toast({ title: 'Domain verified!', description: domain.hostname });
      queryClient.invalidateQueries({ queryKey: DOMAINS_QUERY_KEY });
    },
    onError: (err: Error) => {
      toast({
        title: 'Verification failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (domain: DomainItem) => {
      const res = await fetch(`/api/admin/domains/${domain.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(body?.message || 'Primary domain cannot be removed');
        }
        throw new Error(body?.message || 'Failed to remove domain');
      }
      return domain;
    },
    onSuccess: (domain) => {
      toast({ title: 'Domain removed', description: domain.hostname });
      queryClient.invalidateQueries({ queryKey: DOMAINS_QUERY_KEY });
      setPendingDelete(null);
    },
    onError: (err: Error) => {
      toast({
        title: 'Cannot remove',
        description: err.message,
        variant: 'destructive',
      });
      setPendingDelete(null);
    },
  });

  const domains = data?.domains ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-[Outfit] text-2xl font-semibold flex items-center gap-2">
            <Globe className="w-6 h-6 text-[#1C53A3]" /> Domains
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your own hostname so customers can book from your branded URL.
          </p>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className={BRAND_YELLOW_BTN}
          data-testid="add-domain-button"
        >
          <Plus className="w-4 h-4 mr-1" /> Add Custom Domain
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold font-[Outfit]">
            Your domains
          </CardTitle>
          <CardDescription>
            Add a TXT record at <code>_xkedule.&lt;hostname&gt;</code> to verify ownership.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#1C53A3]" />
            </div>
          ) : domains.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <p className="text-muted-foreground">
                No domains yet. Add your first custom domain to get started.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                className={BRAND_YELLOW_BTN}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Custom Domain
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((domain) => (
                  <TableRow key={domain.id}>
                    <TableCell className="font-mono">{domain.hostname}</TableCell>
                    <TableCell>
                      <StatusBadge domain={domain} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {!domain.isPrimary && !domain.verified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => verifyMutation.mutate(domain)}
                          disabled={
                            verifyMutation.isPending &&
                            verifyMutation.variables?.id === domain.id
                          }
                        >
                          {verifyMutation.isPending &&
                          verifyMutation.variables?.id === domain.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Verifying…
                            </>
                          ) : (
                            'Verify'
                          )}
                        </Button>
                      )}
                      {!domain.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => setPendingDelete(domain)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddDomainDialog open={addOpen} onOpenChange={setAddOpen} />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove domain?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `This will remove "${pendingDelete.hostname}" from your account. Customers will no longer reach your booking page via this hostname.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) removeMutation.mutate(pendingDelete);
              }}
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
