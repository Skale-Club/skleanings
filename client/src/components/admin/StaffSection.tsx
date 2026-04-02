import * as React from 'react';
import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StaffMember } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer } from '@/components/admin/shared/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Users2, Upload, Settings } from 'lucide-react';
import { StaffManageDialog } from '@/components/admin/StaffManageDialog';

function StaffAvatar({ member }: { member: StaffMember }) {
  if (member.profileImageUrl) {
    return (
      <img
        src={member.profileImageUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = `${member.firstName[0]}${member.lastName[0]}`.toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
      {initials}
    </div>
  );
}

function SortableStaffItem({
  member,
  onEdit,
  onManage,
  onDelete,
  onToggle,
}: {
  member: StaffMember;
  onEdit: (member: StaffMember) => void;
  onManage: (member: StaffMember) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg bg-muted transition-all group relative"
      data-testid={`staff-item-${member.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <StaffAvatar member={member} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-base line-clamp-1">
              {member.firstName} {member.lastName}
            </h3>
            {!member.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          {member.email && (
            <p className="text-muted-foreground text-xs line-clamp-1">{member.email}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-2">
            <Switch
              checked={member.isActive}
              onCheckedChange={(checked) => onToggle(member.id, checked)}
              data-testid={`switch-staff-active-${member.id}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onManage(member)}
            data-testid={`button-manage-staff-${member.id}`}
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(member)}
            data-testid={`button-edit-staff-${member.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-testid={`button-delete-staff-${member.id}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete staff member?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. Existing bookings will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(member.id)}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export function StaffSection() {
  const { toast } = useToast();
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [managingMember, setManagingMember] = useState<StaffMember | null>(null);
  const scrollPositionRef = useRef<number>(0);

  const { data: members, isLoading } = useQuery<StaffMember[]>({
    queryKey: ['/api/staff', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/staff?includeInactive=1');
      if (!res.ok) throw new Error('Failed to load staff members');
      return res.json();
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createStaff = useMutation({
    mutationFn: async (data: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>) => {
      return apiRequest('POST', '/api/staff', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', 'all'] });
      toast({ title: 'Staff member created successfully' });
      setIsDialogOpen(false);
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create staff member', description: error.message, variant: 'destructive' });
    },
  });

  const updateStaff = useMutation({
    mutationFn: async (data: Partial<StaffMember> & { id: number }) => {
      const { id, ...rest } = data;
      return apiRequest('PUT', `/api/staff/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', 'all'] });
      toast({ title: 'Staff member updated successfully' });
      setEditingMember(null);
      setIsDialogOpen(false);
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update staff member', description: error.message, variant: 'destructive' });
    },
  });

  const deleteStaff = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', 'all'] });
      toast({ title: 'Staff member deleted successfully' });
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete staff member', description: error.message, variant: 'destructive' });
    },
  });

  const toggleStaff = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PUT', `/api/staff/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', 'all'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update staff member', description: error.message, variant: 'destructive' });
    },
  });

  const reorderStaff = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('PUT', '/api/staff/reorder', { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff', 'all'] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && members) {
      const oldIndex = members.findIndex((m) => m.id === active.id);
      const newIndex = members.findIndex((m) => m.id === over.id);
      const reordered = arrayMove(members, oldIndex, newIndex);
      const updates = reordered.map((m, index) => ({ id: m.id, order: index }));
      reorderStaff.mutate(updates);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              scrollPositionRef.current = window.scrollY;
            } else {
              setEditingMember(null);
            }
            setIsDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-add-staff">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <StaffForm
              member={editingMember}
              onSubmit={(data) => {
                if (editingMember) {
                  updateStaff.mutate({ ...data, id: editingMember.id });
                } else {
                  createStaff.mutate(data);
                }
              }}
              isLoading={createStaff.isPending || updateStaff.isPending}
              nextOrder={members?.length || 0}
            />
          </DialogContent>
        </Dialog>
      </div>

      {members?.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-lg">
          <Users2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No staff members yet</h3>
          <p className="text-muted-foreground mb-4">
            Add team members to let customers choose who performs their service
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={members?.map((m) => m.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-2">
              {members?.map((member) => (
                <SortableStaffItem
                  key={member.id}
                  member={member}
                  onEdit={(m) => {
                    scrollPositionRef.current = window.scrollY;
                    setEditingMember(m);
                    setIsDialogOpen(true);
                  }}
                  onManage={(m) => setManagingMember(m)}
                  onDelete={(id) => deleteStaff.mutate(id)}
                  onToggle={(id, isActive) => toggleStaff.mutate({ id, isActive })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {managingMember && (
        <StaffManageDialog
          staffId={managingMember.id}
          staffName={`${managingMember.firstName} ${managingMember.lastName}`}
          open={!!managingMember}
          onOpenChange={(open) => { if (!open) setManagingMember(null); }}
        />
      )}
    </div>
  );
}

type StaffFormData = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  order: number;
};

function StaffForm({
  member,
  onSubmit,
  isLoading,
  nextOrder,
}: {
  member: StaffMember | null;
  onSubmit: (data: StaffFormData) => void;
  isLoading: boolean;
  nextOrder: number;
}) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(member?.firstName || '');
  const [lastName, setLastName] = useState(member?.lastName || '');
  const [email, setEmail] = useState(member?.email || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [bio, setBio] = useState(member?.bio || '');
  const [profileImageUrl, setProfileImageUrl] = useState(member?.profileImageUrl || '');
  const [isActive, setIsActive] = useState(member?.isActive ?? true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadFileToServer(file);
      setProfileImageUrl(url);
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      bio: bio || null,
      profileImageUrl: profileImageUrl || null,
      isActive,
      order: member?.order ?? nextOrder,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{member ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="staff-first-name">First Name</Label>
            <Input
              id="staff-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="Jane"
              data-testid="input-staff-first-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-last-name">Last Name</Label>
            <Input
              id="staff-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Smith"
              data-testid="input-staff-last-name"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            data-testid="input-staff-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-phone">Phone</Label>
          <Input
            id="staff-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            data-testid="input-staff-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-bio">Bio</Label>
          <Textarea
            id="staff-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Brief description..."
            rows={3}
            data-testid="input-staff-bio"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="staff-photo">Profile Photo</Label>
          <div className="flex gap-2">
            <Input
              id="staff-photo"
              value={profileImageUrl}
              onChange={(e) => setProfileImageUrl(e.target.value)}
              placeholder="https://... or upload below"
              data-testid="input-staff-photo-url"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-staff-photo-upload"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="staff-active">Active</Label>
            <p className="text-xs text-muted-foreground">
              Show this staff member for booking
            </p>
          </div>
          <Switch
            id="staff-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid="switch-staff-active"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-staff">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {member ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}
