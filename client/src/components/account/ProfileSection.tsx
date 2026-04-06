import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuth } from '@/context/AuthContext';
import { authenticatedRequest } from '@/lib/queryClient';
import { uploadFileToServer } from '@/components/admin/shared/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User as UserIcon } from 'lucide-react';

type ClientProfile = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profileImageUrl: string | null;
};

export function ProfileSection() {
  const { getAccessToken } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery<ClientProfile>({
    queryKey: ['/api/client/me'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await authenticatedRequest('GET', '/api/client/me', token);
      return res.json();
    },
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhone(profile.phone || '');
      setProfileImageUrl(profile.profileImageUrl || '');
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No access token');
      const res = await authenticatedRequest('PATCH', '/api/client/me', token, {
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        profileImageUrl: profileImageUrl || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/me'] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-5">
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
          <label htmlFor="client-avatar-upload">
            <Button variant="outline" size="sm" asChild disabled={uploading}>
              <span className="cursor-pointer">
                {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Upload Photo
              </span>
            </Button>
          </label>
          <input
            id="client-avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
          />
          <p className="text-xs text-muted-foreground mt-1">Max 1MB. JPG, PNG.</p>
        </div>
      </div>

      {/* Name fields */}
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

      {/* Phone */}
      <div className="space-y-1">
        <Label>Phone</Label>
        <Input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </div>

      {/* Email — read-only */}
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={profile?.email || ''} readOnly className="bg-slate-50 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
