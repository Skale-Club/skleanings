import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import type { Service } from '@shared/schema';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Clock, Eye, EyeOff, GripVertical, Package, Pencil, Trash2 } from 'lucide-react';

export function ServiceListRow({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
  index,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-card border border-border shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <button className="p-2 text-muted-foreground hover:text-foreground rounded-md cursor-grab active:cursor-grabbing self-center" {...attributes} {...listeners} aria-label="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="w-28 sm:w-32 aspect-[4/3] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity" onClick={onEdit}>
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-1">{service.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] border-0 bg-secondary">#{index + 1}</Badge>
            {service.isHidden && (
              <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Add-on Only
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-primary">${service.price}</span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{durationLabel}</span>
          </div>
          <Badge variant="secondary" className="w-fit border-0 bg-secondary">{categoryName}</Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onToggleLanding} className="bg-card border-0 text-slate-600 hover:text-slate-800" title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}>
            {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="bg-card border-0" data-testid={`button-edit-service-${service.id}`}>
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card border-0" data-testid={`button-delete-service-${service.id}`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{service.name}". This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} variant="destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
