import type { DateRange } from '../MarketingSection';

interface Props {
  dateRange: DateRange;
  getAccessToken: () => Promise<string | null>;
}

export function MarketingOverviewTab({ dateRange, getAccessToken }: Props) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <p>Overview tab — loading...</p>
    </div>
  );
}
