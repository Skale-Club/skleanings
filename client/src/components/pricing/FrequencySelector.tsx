import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ServiceFrequency {
  id: number;
  name: string;
  discountPercent: string;
}

interface FrequencySelectorProps {
  frequencies: ServiceFrequency[];
  onSelect: (frequency: ServiceFrequency | null, discountPercent: number) => void;
  selectedId?: number | null;
}

export function FrequencySelector({
  frequencies,
  onSelect,
  selectedId
}: FrequencySelectorProps) {
  // Add "One time" as default option if not present
  const allOptions: (ServiceFrequency | { id: number; name: string; discountPercent: string })[] = [
    { id: 0, name: 'One time', discountPercent: '0' },
    ...frequencies
  ];

  const handleSelect = (idString: string) => {
    const id = parseInt(idString);
    if (id === 0) {
      onSelect(null, 0);
    } else {
      const freq = frequencies.find(f => f.id === id);
      if (freq) {
        onSelect(freq, parseFloat(freq.discountPercent));
      }
    }
  };

  if (frequencies.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Service Frequency</Label>
      <p className="text-xs text-muted-foreground">
        Choose recurring service for a discount. We'll contact you to schedule future visits.
      </p>

      <RadioGroup
        value={String(selectedId || 0)}
        onValueChange={handleSelect}
        className="space-y-2"
      >
        {allOptions.map(freq => {
          const discount = parseFloat(freq.discountPercent);
          const hasDiscount = discount > 0;

          return (
            <div
              key={freq.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                (selectedId || 0) === freq.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
              onClick={() => handleSelect(String(freq.id))}
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={String(freq.id)} id={`freq-${freq.id}`} />
                <Label htmlFor={`freq-${freq.id}`} className="cursor-pointer font-medium">
                  {freq.name}
                </Label>
              </div>

              {hasDiscount && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Save {discount}%
                </Badge>
              )}
            </div>
          );
        })}
      </RadioGroup>
    </div>
  );
}
