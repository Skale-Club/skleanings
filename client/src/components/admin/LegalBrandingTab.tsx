import { useRef, useState } from 'react';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettingsData } from '@/components/admin/shared/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, Image, Loader2 } from 'lucide-react';

interface LegalBrandingTabProps {
  settings: CompanySettingsData;
  updateField: <K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => void;
  getAccessToken: () => Promise<string | null>;
  isSaving: boolean;
}

const SERVICE_DELIVERY_OPTIONS = [
  { value: 'at-customer', title: 'At Customer Location', subtitle: 'We travel to your customers' },
  { value: 'customer-comes-in', title: 'Customer Comes In', subtitle: 'Customers visit your location' },
  { value: 'both', title: 'Both', subtitle: 'We serve customers on-site and at their location' },
];

export function LegalBrandingTab({ settings, updateField, getAccessToken, isSaving }: LegalBrandingTabProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json();
      await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      updateField('faviconUrl', objectPath);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      toast({ title: 'Asset uploaded and saved' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-muted p-6 rounded-lg space-y-6">
      {/* Section heading */}
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Legal &amp; Branding</h2>
      </div>

      {/* Sub-section 1: Favicon */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Favicon</Label>
          <p className="text-sm text-muted-foreground mt-1">Upload a .png, .ico, or .svg file (32x32px recommended)</p>
        </div>
        {settings.faviconUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={settings.faviconUrl}
              alt="Current favicon"
              className="w-12 h-12 object-contain rounded border"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label="Upload favicon"
            >
              {isUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</>
              ) : (
                'Replace Favicon'
              )}
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-muted-foreground/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Image className="w-12 h-12 text-muted-foreground" />
            <Button
              variant="outline"
              size="sm"
              disabled={isUploading}
              aria-label="Upload favicon"
            >
              {isUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Uploading...</>
              ) : (
                'Upload Favicon'
              )}
            </Button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.ico,.svg,.jpg,.jpeg"
          className="hidden"
          onChange={handleFaviconUpload}
        />
      </div>

      <Separator />

      {/* Sub-section 2: Service Delivery Model */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">Service Delivery Model</Label>
          <p className="text-sm text-muted-foreground mt-1">How your business delivers services to customers</p>
        </div>
        <RadioGroup
          value={settings.serviceDeliveryModel || 'at-customer'}
          onValueChange={(value) => updateField('serviceDeliveryModel', value)}
          className="space-y-3"
        >
          {SERVICE_DELIVERY_OPTIONS.map(({ value, title, subtitle }) => (
            <div key={value} className="flex items-start space-x-3">
              <RadioGroupItem value={value} id={`sdm-${value}`} className="mt-1" />
              <Label htmlFor={`sdm-${value}`} className="cursor-pointer space-y-0.5">
                <span className="font-semibold text-sm">{title}</span>
                <p className="text-sm text-muted-foreground font-normal">{subtitle}</p>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Sub-section 3: Privacy Policy Content */}
      <div className="space-y-2">
        <Label htmlFor="privacy-content" className="text-sm font-semibold">Privacy Policy Content</Label>
        <p id="privacy-helper" className="text-sm text-muted-foreground">
          Paste HTML or plain text. Leave empty to show the default placeholder for visitors.
        </p>
        <Textarea
          id="privacy-content"
          aria-describedby="privacy-helper"
          value={settings.privacyPolicyContent || ''}
          onChange={(e) => updateField('privacyPolicyContent', e.target.value)}
          placeholder="Paste your privacy policy content here..."
          className="min-h-[400px] font-mono text-sm"
        />
      </div>

      {/* Sub-section 4: Terms of Service Content */}
      <div className="space-y-2">
        <Label htmlFor="terms-content" className="text-sm font-semibold">Terms of Service Content</Label>
        <p id="terms-helper" className="text-sm text-muted-foreground">
          Paste HTML or plain text. Leave empty to show the default placeholder for visitors.
        </p>
        <Textarea
          id="terms-content"
          aria-describedby="terms-helper"
          value={settings.termsOfServiceContent || ''}
          onChange={(e) => updateField('termsOfServiceContent', e.target.value)}
          placeholder="Paste your terms of service content here..."
          className="min-h-[400px] font-mono text-sm"
        />
      </div>
    </div>
  );
}
