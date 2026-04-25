import { useState } from 'react';
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { BarChart2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MarketingOverviewTab } from './marketing/MarketingOverviewTab';
import { MarketingSourcesTab } from './marketing/MarketingSourcesTab';
import { MarketingCampaignsTab } from './marketing/MarketingCampaignsTab';

// Date range types — exported for use by tab sub-components
export type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  preset: DatePreset;
}

/** Computes from/to for each preset using date-fns. DST-safe. */
function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), preset };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y), preset };
    }
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), preset };
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), preset };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfDay(now), preset };
    case 'lastMonth': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm), preset };
    }
    default:
      // custom — keep current range, just change preset label
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), preset: 'last30' };
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today:     'Today',
  yesterday: 'Yesterday',
  last7:     'Last 7 days',
  last30:    'Last 30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  custom:    'Custom',
};

interface Props {
  getAccessToken: () => Promise<string | null>;
}

export function MarketingSection({ getAccessToken }: Props) {
  // D-03: Default = Last 30 days (FILTER-03)
  const [dateRange, setDateRange] = useState<DateRange>(() => getPresetRange('last30'));

  // D-07: Local useState for tab switching (NOT useSlugTab — consistent with BlogSection)
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'campaigns'>('overview');

  function handlePresetChange(preset: string) {
    if (preset === 'custom') {
      // Custom: keep current dates, just update preset label
      setDateRange((prev) => ({ ...prev, preset: 'custom' }));
    } else {
      setDateRange(getPresetRange(preset as DatePreset));
    }
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Marketing
          </h1>
          <p className="text-muted-foreground">
            Where your visitors are coming from and which sources produce bookings
          </p>
        </div>

        {/* D-02: Global date range selector, above tabs */}
        <div className="shrink-0">
          <Select value={dateRange.preset} onValueChange={handlePresetChange}>
            <SelectTrigger className="h-9 w-[160px] text-xs border-0 bg-muted font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PRESET_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* D-07: Tabs — shadcn Tabs component with local state */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <MarketingOverviewTab dateRange={dateRange} getAccessToken={getAccessToken} />
        </TabsContent>
        <TabsContent value="sources" className="mt-6">
          <MarketingSourcesTab dateRange={dateRange} getAccessToken={getAccessToken} />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-6">
          <MarketingCampaignsTab dateRange={dateRange} getAccessToken={getAccessToken} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
