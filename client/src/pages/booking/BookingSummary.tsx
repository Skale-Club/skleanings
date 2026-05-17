import { format } from 'date-fns';
import { clsx } from 'clsx';
import { toDateFnsFormat } from '@/lib/locale';
import { ChevronRight, X, Minus, Plus } from 'lucide-react';
import type { ServiceFrequency, StaffMember } from '@shared/schema';

// Local helper — matches the formatTime in BookingPage.tsx
function formatTime(time24: string, timeFormat: string): string {
  if (timeFormat === '24h') return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

interface CartItemDisplay {
  id: number;
  name: string;
  quantity: number;
  calculatedPrice: number;
  areaSize?: string;
  areaValue?: number;
  selectedOptions?: Array<{ name: string; quantity: number }>;
  selectedFrequency?: { name: string; discountPercent: number } | null;
  customerNotes?: string;
}

interface BookingSummaryProps {
  items: CartItemDisplay[];
  step: 2 | 3 | 4 | 5;
  selectedDate: string;
  selectedTime: string;
  selectedStaff: StaffMember | null;
  totalDuration: number;
  totalPrice: number;
  finalPrice: number;
  isBelowMinimum: boolean;
  minimumBookingValue: number;
  adjustmentAmount: number;
  timeFormat: string;
  dateFormat?: string;
  frequencies: ServiceFrequency[] | undefined;
  selectedFrequencyId: number | null;
  onSelectFrequency: (id: number | null) => void;
  onRemoveItem: (id: number) => void;
  onUpdateQuantity: (id: number, qty: number) => void;
  onContinueToContact: () => void;
}

export function BookingSummary({
  items,
  step,
  selectedDate,
  selectedTime,
  selectedStaff,
  totalDuration,
  totalPrice,
  finalPrice,
  isBelowMinimum,
  minimumBookingValue,
  adjustmentAmount,
  timeFormat,
  dateFormat,
  frequencies,
  selectedFrequencyId,
  onSelectFrequency,
  onRemoveItem,
  onUpdateQuantity,
  onContinueToContact,
}: BookingSummaryProps) {
  return (
    <div className="lg:col-span-1">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 sticky top-24">
        <h3 className="font-bold text-xl mb-4 text-slate-900">Booking Summary</h3>

        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-700 font-medium text-sm leading-tight line-clamp-2 flex-1">{item.name}</span>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                  aria-label="Remove item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {item.areaSize && (
                <span className="text-xs text-slate-500">Size: {item.areaSize}{item.areaValue ? ` (${item.areaValue} sqft)` : ''}</span>
              )}
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <div className="text-xs text-slate-500">
                  Add-ons: {item.selectedOptions.map(opt => `${opt.name}${opt.quantity > 1 ? ` x${opt.quantity}` : ''}`).join(', ')}
                </div>
              )}
              {item.selectedFrequency && (
                <span className="text-xs text-slate-500">
                  Frequency: {item.selectedFrequency.name}
                  {item.selectedFrequency.discountPercent > 0 && ` (-${item.selectedFrequency.discountPercent}%)`}
                </span>
              )}
              {item.customerNotes && (
                <span className="text-xs text-slate-500 italic">Note: {item.customerNotes.substring(0, 50)}{item.customerNotes.length > 50 ? '...' : ''}</span>
              )}

              <div className="flex justify-between items-center">
                <div className="flex items-center bg-white rounded-lg p-0.5 gap-1 border border-slate-200 shadow-sm">
                  <button
                    onClick={() => {
                      if (item.quantity > 1) {
                        onUpdateQuantity(item.id, item.quantity - 1);
                      } else {
                        onRemoveItem(item.id);
                      }
                    }}
                    className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-bold w-5 text-center text-slate-900">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-slate-50 rounded transition-colors text-slate-600"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="font-bold text-sm text-slate-900">${item.calculatedPrice.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between text-slate-500 text-sm">
            <span>Duration</span>
            <span>{Math.floor(totalDuration / 60)}h {totalDuration % 60}m</span>
          </div>
          {selectedDate && (
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Date</span>
              <span>{format(new Date(selectedDate), toDateFnsFormat(dateFormat ?? 'MM/DD/YYYY'))}</span>
            </div>
          )}
          {selectedTime && (
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Time</span>
              <span>{formatTime(selectedTime, timeFormat)}</span>
            </div>
          )}
          {selectedStaff && (
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Professional</span>
              <span>{selectedStaff.firstName} {selectedStaff.lastName}</span>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          <div className="flex justify-between text-slate-600 text-sm">
            <span>Subtotal</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
          {isBelowMinimum && (
            <div className="flex justify-between text-slate-500 text-sm">
              <span>Minimum order adjustment</span>
              <span>+${adjustmentAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4 mt-2 flex justify-between items-center">
          <span className="font-bold text-lg text-slate-900">Total</span>
          <span className="font-bold text-2xl text-primary">${finalPrice.toFixed(2)}</span>
        </div>

        {isBelowMinimum && (
          <p className="text-xs text-slate-400 mt-2">
            A minimum order of ${minimumBookingValue.toFixed(2)} applies
          </p>
        )}

        {/* Phase 28 RECUR-01: frequency selector — shown after time slot selected, single-service carts only */}
        {step === 3 && selectedDate && selectedTime && frequencies && frequencies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">How often?</p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onSelectFrequency(null)}
                className={clsx(
                  "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                  selectedFrequencyId === null
                    ? "border-primary bg-primary/5 font-semibold"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                One-time cleaning
              </button>
              {frequencies.map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => onSelectFrequency(f.id)}
                  className={clsx(
                    "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
                    selectedFrequencyId === f.id
                      ? "border-primary bg-primary/5 font-semibold"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <span>{f.name}</span>
                  {Number(f.discountPercent) > 0 && (
                    <span className="ml-2 text-green-600 font-bold">
                      {Number(f.discountPercent)}% off
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          {step === 3 && (
            <button
              disabled={!selectedDate || !selectedTime}
              onClick={onContinueToContact}
              className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Continue to Contact <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
