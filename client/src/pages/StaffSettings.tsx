import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AuthContext';
import { useCompanySettings } from '@/context/CompanySettingsContext';
import { authenticatedRequest } from '@/lib/queryClient';
import { CalendarTab } from '@/components/admin/CalendarTab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { uploadFileToServer } from '@/components/admin/shared/utils';
import { Loader2, LogOut, User as UserIcon } from 'lucide-react';
import type { StaffMember } from '@shared/schema';

export default function StaffSettings() {
  const { signOut, getAccessToken } = useAdminAuth();
  const { settings: companySettings } = useCompanySettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: staffMember, isLoading } = useQuery<StaffMember>({
    queryKey: ['/api/staff/me'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await authenticatedRequest('GET', '/api/staff/me', token);
      return res.json();
    },
  });

  useEffect(() => {
    if (staffMember) {
      setFirstName(staffMember.firstName || '');
      setLastName(staffMember.lastName || '');
      setPhone(staffMember.phone || '');
      setBio(staffMember.bio || '');
      setProfileImageUrl(staffMember.profileImageUrl || '');
    }
  }, [staffMember]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await authenticatedRequest('PATCH', '/api/staff/me', token, {
        firstName,
        lastName,
        phone: phone || null,
        bio: bio || null,
        profileImageUrl: profileImageUrl || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff/me'] });
      toast({ title: 'Profile saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFileToServer(file);
      setProfileImageUrl(url);
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setLocation('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Minimal header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          {companySettings?.companyName || 'Settings'}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">My Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your profile and calendar connection.</p>
        </div>

        {/* Profile section */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Profile</h2>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profileImageUrl || undefined} />
              <AvatarFallback>
                {firstName?.[0] && lastName?.[0]
                  ? `${firstName[0]}${lastName[0]}`
                  : <UserIcon className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <label htmlFor="avatar-upload">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span className="cursor-pointer">
                    {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Upload Photo
                  </span>
                </Button>
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <p className="text-xs text-muted-foreground mt-1">Max 1MB. JPG, PNG.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>First Name</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>

          <div className="space-y-1">
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="Tell customers about yourself..."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Calendar section */}
        {staffMember && (
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <CalendarTab staffId={staffMember.id} />
          </div>
        )}
      </main>
    </div>
  );
}
