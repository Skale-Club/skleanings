import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface AreaSizePreset {
  name: string;
  sqft: number | null;
  price: number;
}

interface AreaSizeSelectorProps {
  areaSizes: AreaSizePreset[];
  pricePerUnit?: string | null;
  minimumPrice?: string | null;
  onSelect: (selection: { areaSize: string; areaValue?: number; price: number }) => void;
  selectedSize?: string;
}

export function AreaSizeSelector({
  areaSizes,
  pricePerUnit,
  minimumPrice,
  onSelect,
  selectedSize
}: AreaSizeSelectorProps) {
  const [customSqft, setCustomSqft] = useState<string>('');
  const [selected, setSelected] = useState<string>(selectedSize || '');
  const minimum = parseFloat(minimumPrice || '0');

  const handlePresetSelect = (preset: AreaSizePreset) => {
    const finalPrice = Math.max(preset.price, minimum);
    setSelected(preset.name);
    onSelect({
      areaSize: preset.name,
      areaValue: preset.sqft || undefined,
      price: finalPrice
    });
  };

  const handleCustomSqftChange = (value: string) => {
    setCustomSqft(value);
    setSelected('custom');

    const sqft = parseFloat(value);
    if (!isNaN(sqft) && sqft > 0 && pricePerUnit) {
      const calculatedPrice = sqft * parseFloat(pricePerUnit);
      const finalPrice = Math.max(calculatedPrice, minimum);

      onSelect({
        areaSize: 'custom',
        areaValue: sqft,
        price: finalPrice
      });
    }
  };

  return (
    <div className="space-y-4">
      <Label className="text-sm font-medium">Select Size</Label>

      <RadioGroup value={selected} className="space-y-2">
        {areaSizes.map((preset, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              selected === preset.name
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => handlePresetSelect(preset)}
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value={preset.name} id={`size-${index}`} />
              <Label htmlFor={`size-${index}`} className="cursor-pointer">
                <span className="font-medium">{preset.name}</span>
                {preset.sqft && (
                  <span className="text-muted-foreground ml-2">
                    (up to {preset.sqft} sqft)
                  </span>
                )}
              </Label>
            </div>
            <span className="font-semibold text-primary">
              ${Math.max(preset.price, minimum).toFixed(2)}
            </span>
          </div>
        ))}

        {/* Custom Size Option */}
        {pricePerUnit && (
          <div
            className={`p-3 rounded-lg border transition-colors ${
              selected === 'custom'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <RadioGroupItem
                value="custom"
                id="size-custom"
                onClick={() => setSelected('custom')}
              />
              <Label htmlFor="size-custom" className="cursor-pointer font-medium">
                Custom Size
              </Label>
            </div>

            <div className="flex items-center gap-2 ml-6">
              <Input
                type="number"
                placeholder="Enter sqft"
                value={customSqft}
                onChange={(e) => handleCustomSqftChange(e.target.value)}
                className="w-32"
                min="1"
              />
              <span className="text-sm text-muted-foreground">sqft</span>
              <span className="text-sm text-muted-foreground ml-2">
                @ ${parseFloat(pricePerUnit).toFixed(2)}/sqft
              </span>
              {customSqft && !isNaN(parseFloat(customSqft)) && (
                <span className="font-semibold text-primary ml-auto">
                  ${Math.max(
                    parseFloat(customSqft) * parseFloat(pricePerUnit),
                    parseFloat(minimumPrice || '0')
                  ).toFixed(2)}
                </span>
              )}
            </div>

            {minimumPrice && parseFloat(minimumPrice) > 0 && (
              <p className="text-xs text-muted-foreground ml-6 mt-1">
                Minimum charge: ${parseFloat(minimumPrice).toFixed(2)}
              </p>
            )}
          </div>
        )}
      </RadioGroup>
    </div>
  );
}
