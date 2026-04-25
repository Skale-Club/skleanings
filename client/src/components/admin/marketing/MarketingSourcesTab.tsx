import type { DateRange } from '../MarketingSection';

interface Props {
  dateRange: DateRange;
  getAccessToken: () => Promise<string | null>;
}

export function MarketingSourcesTab({ dateRange, getAccessToken }: Props) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <p>Sources tab — loading...</p>
    </div>
  );
}
