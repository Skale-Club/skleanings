import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, GripVertical, LogOut, type LucideIcon } from 'lucide-react';
import { Link } from 'wouter';
import type { AdminSection, CompanySettingsData } from '@/components/admin/shared/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export type AdminMenuItem = { id: AdminSection; title: string; icon: LucideIcon };

interface AdminSidebarProps {
  companySettings?: CompanySettingsData;
  email?: string | null;
  menuItems: AdminMenuItem[];
  sectionsOrder: AdminSection[];
  activeSection: AdminSection;
  onSectionSelect: (section: AdminSection) => void;
  onSectionsReorder: (nextOrder: AdminSection[]) => void;
  onLogout: () => void | Promise<void>;
}

export function AdminSidebar({
  companySettings,
  email,
  menuItems,
  sectionsOrder,
  activeSection,
  onSectionSelect,
  onSectionsReorder,
  onLogout,
}: AdminSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sectionsOrder.indexOf(active.id as AdminSection);
    const newIndex = sectionsOrder.indexOf(over.id as AdminSection);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sectionsOrder, oldIndex, newIndex);
    onSectionsReorder(reordered);
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border bg-sidebar">
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
            Back to website
          </Link>
          <div className="flex items-center gap-3">
            {companySettings?.logoIcon ? (
              <img
                src={companySettings.logoIcon}
                alt={companySettings.companyName || 'Logo'}
                className="w-10 h-10 object-contain"
                data-testid="img-admin-logo"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                {companySettings?.companyName?.[0] || 'A'}
              </div>
            )}
            <span className="font-semibold text-lg text-primary truncate">
              {companySettings?.companyName || 'Admin Panel'}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sectionsOrder} strategy={verticalListSortingStrategy}>
                <SidebarMenu>
                  {sectionsOrder.map((sectionId) => {
                    const item = menuItems.find((i) => i.id === sectionId);
                    if (!item) return null;
                    return (
                      <SidebarSortableItem
                        key={item.id}
                        item={item}
                        isActive={activeSection === item.id}
                        onSelect={() => onSectionSelect(item.id)}
                      />
                    );
                  })}
                </SidebarMenu>
              </SortableContext>
            </DndContext>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border mt-auto bg-sidebar">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Logged in as</p>
              <p className="font-medium truncate text-foreground">{email}</p>
            </div>
            <ThemeToggle variant="icon" className="text-muted-foreground hover:text-foreground" />
          </div>
          <Button variant="default" className="w-full" onClick={onLogout} data-testid="button-logout">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarSortableItem({
  item,
  isActive,
  onSelect,
}: {
  item: AdminMenuItem;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <SidebarMenuItem ref={setNodeRef} style={style}>
      <SidebarMenuButton
        isActive={isActive}
        onClick={() => {
          onSelect();
          if (isMobile) {
            setOpenMobile(false);
          }
        }}
        className="w-full justify-start group/item"
      >
        <button type="button" {...attributes} {...listeners} className="mr-2 cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 focus:opacity-100 transition-opacity">
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <item.icon className="w-4 h-4" />
        <span>{item.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
