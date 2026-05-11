import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import type { CompanySettings } from '@shared/schema';

function LegalEmptyState({ settings, type }: { settings: CompanySettings | undefined; type: 'privacy' | 'terms' }) {
  const label = type === 'privacy' ? 'privacy policy' : 'terms of service';
  const contacts = [settings?.companyEmail, settings?.companyPhone].filter(Boolean);
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="max-w-md space-y-3">
        <p className="text-lg text-gray-700">
          Our {label} is being finalized.
        </p>
        <p className="text-gray-500">
          {contacts.length > 0
            ? `For questions, please contact ${contacts.join(' or ')}.`
            : 'For questions, please contact us through our website.'}
        </p>
      </div>
    </div>
  );
}

export default function TermsOfService() {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
    staleTime: 1000 * 60 * 5,
  });

  const content = settings?.termsOfServiceContent;
  const hasContent = Boolean(content?.trim());

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-primary text-white py-16">
        <div className="container-custom">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="w-10 h-10" />
            <h1 className="text-4xl font-bold font-heading text-white">Terms of Service</h1>
          </div>
        </div>
      </div>

      <div className="container-custom py-12">
        {hasContent ? (
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: content! }}
          />
        ) : (
          <LegalEmptyState settings={settings} type="terms" />
        )}
      </div>
    </div>
  );
}
