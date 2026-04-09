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

export function ServiceGridItem({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative overflow-hidden rounded-lg bg-muted transition-all h-full flex flex-col",
        isDragging && "ring-2 ring-primary/40 shadow-lg bg-card/80",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <button
        className="absolute top-2 left-2 z-20 p-2 text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur-sm rounded-md shadow-sm cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleLanding(); }}
        className={clsx(
          "absolute top-2 right-2 z-20 p-2 rounded-md shadow-sm transition-all",
          service.showOnLanding
            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
            : "bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground"
        )}
        title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}
      >
        {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>

      {service.imageUrl ? (
        <div className="w-full aspect-[4/3] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={onEdit}>
          <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground cursor-pointer hover:opacity-90 transition-opacity" onClick={onEdit}>
          <Package className="w-5 h-5" />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg leading-tight pr-6">{service.name}</h3>
          {service.isHidden && (
            <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Add-on Only
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-primary mb-2">${service.price}</div>
        <Badge variant="secondary" className="w-fit border-0 bg-secondary mb-2">{categoryName}</Badge>
        <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Clock className="w-4 h-4" />
          <span>{durationLabel}</span>
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 bg-card dark:bg-slate-700/60 border-0" data-testid={`button-edit-service-${service.id}`}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-card dark:bg-slate-700/60 border-0" data-testid={`button-delete-service-${service.id}`}>
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
    </div>
  );
}
