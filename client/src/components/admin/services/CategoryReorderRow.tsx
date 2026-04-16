import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import type { Category, Subcategory } from '@shared/schema';
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
import { FolderOpen, GripVertical, Pencil, Trash2 } from 'lucide-react';

export function CategoryReorderRow({
  category,
  serviceCount,
  onEdit,
  onDelete,
  disableDelete,
  index,
  onManageSubcategories,
  subcategories,
}: {
  category: Category;
  serviceCount: number;
  onEdit: () => void;
  onDelete: () => void;
  disableDelete: boolean;
  index: number;
  onManageSubcategories: () => void;
  subcategories?: Subcategory[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const subcategoryCount = subcategories?.filter(sub => sub.categoryId === category.id).length ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg bg-light-gray dark:bg-slate-800 cursor-grab active:cursor-grabbing transition-all shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md"
      )}
      data-testid={`category-item-${category.id}`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <button className="text-muted-foreground cursor-grab p-2 -ml-2" {...attributes} {...listeners} aria-label="Drag to reorder category">
          <GripVertical className="w-4 h-4" />
        </button>
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 sm:hidden">
          <h3 className="font-semibold truncate">{category.name}</h3>
          <Badge variant="secondary" className="mt-1 bg-secondary text-secondary-foreground font-bold">{serviceCount} services</Badge>
          <Badge variant="outline" className="mt-1 border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">{subcategoryCount} subcategories</Badge>
          <Button variant="outline" size="sm" className="mt-2 border-0" onClick={onManageSubcategories}>Manage subcategories</Button>
        </div>
        <div className="flex items-center gap-1 sm:hidden ml-auto">
          <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-category-${category.id}-mobile`}>
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}-mobile`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                <AlertDialogDescription>
                  {disableDelete ? `This category has ${serviceCount} services. You must delete or reassign them first.` : 'This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} disabled={disableDelete} variant="destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{category.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="bg-secondary text-secondary-foreground font-bold">{serviceCount} services</Badge>
            <Badge variant="outline" className="border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">{subcategoryCount} subcategories</Badge>
            <Button variant="outline" size="sm" className="border-0" onClick={onManageSubcategories}>Manage subcategories</Button>
          </div>
        </div>
        <Badge variant="secondary" className="border-0 bg-slate-800 text-white shrink-0 self-center dark:bg-slate-700 dark:text-slate-200">#{index + 1}</Badge>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 break-words sm:hidden">{category.description}</p>

      <div className="hidden sm:flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-category-${category.id}`}>
          <Pencil className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}`}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                {disableDelete ? `This category has ${serviceCount} services. You must delete or reassign them first.` : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} disabled={disableDelete} variant="destructive">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
