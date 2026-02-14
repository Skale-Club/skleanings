import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

interface CustomQuoteFormProps {
  minimumPrice?: string | null;
  onChange: (notes: string) => void;
  initialNotes?: string;
}

export function CustomQuoteForm({
  minimumPrice,
  onChange,
  initialNotes = ''
}: CustomQuoteFormProps) {
  const [notes, setNotes] = useState(initialNotes);

  const handleChange = (value: string) => {
    setNotes(value);
    onChange(value);
  };

  const minPrice = parseFloat(minimumPrice || '0');

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Custom Service Request
          </p>
          <p className="text-amber-700 dark:text-amber-300 mt-1">
            Describe your cleaning needs below. Our team will contact you to discuss details and provide a personalized quote.
          </p>
          {minPrice > 0 && (
            <p className="text-amber-700 dark:text-amber-300 mt-2">
              <strong>Minimum charge:</strong> ${minPrice.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {/* Description Field */}
      <div className="space-y-2">
        <Label htmlFor="custom-notes">Describe your needs</Label>
        <Textarea
          id="custom-notes"
          placeholder="Please describe the cleaning service you need. Include details like:
- Type of space (house, office, etc.)
- Size and number of rooms
- Specific areas or items to clean
- Any special requirements or concerns"
          value={notes}
          onChange={(e) => handleChange(e.target.value)}
          className="min-h-[120px]"
        />
        <p className="text-xs text-muted-foreground">
          The more details you provide, the better we can understand your needs.
        </p>
      </div>
    </div>
  );
}
