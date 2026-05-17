import { CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { queryClient } from '@/lib/queryClient';
import { useSetupStatus } from '@/hooks/useSetupStatus';

export function SetupChecklist() {
  const { data, isLoading } = useSetupStatus();

  // Don't render while loading or if dismissed or all items complete
  if (isLoading || !data) return null;
  if (data.dismissed) return null;
  if (data.hasService && data.hasStaff && data.hasAvailability) return null;

  const handleDismiss = async () => {
    try {
      await fetch('/api/admin/setup-dismiss', {
        method: 'POST',
        credentials: 'include',
      });
      // Invalidate so the card disappears immediately
      queryClient.invalidateQueries({ queryKey: ['/api/admin/setup-status'] });
    } catch {
      // Silently ignore — worst case the card remains visible
    }
  };

  const items: { label: string; done: boolean; href: string }[] = [
    { label: 'Add your first service', done: data.hasService, href: '/admin/services' },
    { label: 'Add a staff member', done: data.hasStaff, href: '/admin/staff' },
    { label: 'Set availability', done: data.hasAvailability, href: '/admin/availability' },
  ];

  return (
    <Card className="mb-6 border-blue-100 bg-blue-50/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-[#1C53A3]">Get started</CardTitle>
        <button
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline"
          aria-label="Dismiss setup checklist"
        >
          Dismiss
        </button>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.href} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              {item.done ? (
                <span className="text-muted-foreground line-through">{item.label}</span>
              ) : (
                <a
                  href={item.href}
                  className="text-[#1C53A3] hover:underline font-medium"
                >
                  {item.label}
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
