import { TelegramSection } from '@/components/admin/TelegramSection';
import { TwilioSection } from '@/components/admin/TwilioSection';
import type { IntegrationTabProps } from './types';

export function MessagingTab({ getAccessToken }: IntegrationTabProps) {
  return (
    <div className="space-y-4">
      <TelegramSection getAccessToken={getAccessToken} />
      <TwilioSection getAccessToken={getAccessToken} />
    </div>
  );
}
