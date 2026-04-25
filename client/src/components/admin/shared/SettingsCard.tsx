import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ icon: Icon, title, children, className }: SettingsCardProps) {
  return (
    <div className={cn('bg-muted p-6 rounded-lg space-y-6 transition-all', className)}>
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        {title}
      </h2>
      {children}
    </div>
  );
}
