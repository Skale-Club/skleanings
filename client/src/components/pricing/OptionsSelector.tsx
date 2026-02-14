import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Minus, Plus } from 'lucide-react';

interface ServiceOption {
  id: number;
  name: string;
  price: string;
  maxQuantity?: number | null;
}

interface SelectedOption {
  optionId: number;
  quantity: number;
}

interface OptionsSelectorProps {
  options: ServiceOption[];
  onChange: (selected: SelectedOption[], total: number) => void;
  initialSelection?: SelectedOption[];
}

export function OptionsSelector({
  options,
  onChange,
  initialSelection = []
}: OptionsSelectorProps) {
  const [selections, setSelections] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    initialSelection.forEach(s => map.set(s.optionId, s.quantity));
    return map;
  });

  useEffect(() => {
    // Convert map to array and calculate total
    const selected: SelectedOption[] = [];
    let total = 0;

    selections.forEach((quantity, optionId) => {
      if (quantity > 0) {
        const option = options.find(o => o.id === optionId);
        if (option) {
          selected.push({ optionId, quantity });
          total += parseFloat(option.price) * quantity;
        }
      }
    });

    onChange(selected, total);
  }, [selections, options]);

  const toggleOption = (optionId: number) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      if (newMap.has(optionId) && newMap.get(optionId)! > 0) {
        newMap.set(optionId, 0);
      } else {
        newMap.set(optionId, 1);
      }
      return newMap;
    });
  };

  const incrementQuantity = (optionId: number, maxQty: number = 10) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(optionId) || 0;
      if (current < maxQty) {
        newMap.set(optionId, current + 1);
      }
      return newMap;
    });
  };

  const decrementQuantity = (optionId: number) => {
    setSelections(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(optionId) || 0;
      if (current > 0) {
        newMap.set(optionId, current - 1);
      }
      return newMap;
    });
  };

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Add-ons (optional)</Label>

      <div className="space-y-2">
        {options.map(option => {
          const quantity = selections.get(option.id) || 0;
          const isSelected = quantity > 0;
          const maxQty = option.maxQuantity || 10;

          return (
            <div
              key={option.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleOption(option.id)}
                  id={`option-${option.id}`}
                />
                <Label
                  htmlFor={`option-${option.id}`}
                  className="cursor-pointer"
                >
                  <span className="font-medium">{option.name}</span>
                  <span className="text-primary ml-2">
                    +${parseFloat(option.price).toFixed(2)}
                  </span>
                </Label>
              </div>

              {isSelected && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => decrementQuantity(option.id)}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => incrementQuantity(option.id, maxQty)}
                    disabled={quantity >= maxQty}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
