import type { CompanySettingsData } from '@/components/admin/shared/types';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe } from 'lucide-react';

interface LegalBrandingTabProps {
  settings: CompanySettingsData;
  updateField: <K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => void;
}

const SERVICE_DELIVERY_OPTIONS = [
  { value: 'at-customer', title: 'At Customer Location', subtitle: 'We travel to your customers' },
  { value: 'customer-comes-in', title: 'Customer Comes In', subtitle: 'Customers visit your location' },
  { value: 'both', title: 'Both', subtitle: 'We serve customers on-site and at their location' },
];

export function LegalBrandingTab({ settings, updateField }: LegalBrandingTabProps) {
  return (
    <div className="bg-muted p-6 rounded-lg space-y-6">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Legal &amp; Branding</h2>
      </div>

      {/* Service Delivery Model */}
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

      {/* Privacy Policy Content */}
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

      {/* Terms of Service Content */}
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
