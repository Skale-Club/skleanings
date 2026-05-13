import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from './bookingSchema';
import { clsx } from 'clsx';
import { ArrowLeft } from 'lucide-react';

interface StepPaymentMethodProps {
  form: UseFormReturn<BookingFormValues>;
  finalPrice: number;
  isBelowMinimum: boolean;
  minimumBookingValue: number;
  adjustmentAmount: number;
  isPending: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  onBack: () => void;
}

export function StepPaymentMethod({
  form,
  finalPrice,
  isBelowMinimum,
  minimumBookingValue,
  adjustmentAmount,
  isPending,
  onSubmit,
  onBack,
}: StepPaymentMethodProps): JSX.Element {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold">Address & Payment</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Street Address</label>
            <input
              {...form.register("customerStreet")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="123 Main St"
            />
            {form.formState.errors.customerStreet && <p className="text-red-500 text-xs">{form.formState.errors.customerStreet.message}</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium text-slate-700">City</label>
              <input
                {...form.register("customerCity")}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Boston"
              />
              {form.formState.errors.customerCity && <p className="text-red-500 text-xs">{form.formState.errors.customerCity.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">State</label>
              <input
                {...form.register("customerState")}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="MA"
              />
              {form.formState.errors.customerState && <p className="text-red-500 text-xs">{form.formState.errors.customerState.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Unit / Apt <span className="text-slate-400 font-normal">(Optional)</span></label>
            <input
              {...form.register("customerUnit")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Apt 4B"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
          <label className="text-sm font-medium text-slate-700 mb-4 block">Payment Method</label>
          <div className="grid grid-cols-2 gap-4">
            <label className={clsx(
              "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
              form.watch("paymentMethod") === "site"
                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                : "border-gray-200 hover:bg-slate-50"
            )}>
              <input type="radio" value="site" {...form.register("paymentMethod")} className="hidden" />
              <span className="font-bold">Pay on Site</span>
              <span className="text-xs opacity-70">Cash or Card upon arrival</span>
            </label>
            <label className={clsx(
              "p-4 rounded-xl border cursor-pointer transition-all flex flex-col items-center gap-2 text-center",
              form.watch("paymentMethod") === "online"
                ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                : "border-gray-200 hover:bg-slate-50"
            )}>
              <input type="radio" value="online" {...form.register("paymentMethod")} className="hidden" />
              <span className="font-bold">Pay Online</span>
              <span className="text-xs opacity-70">Secure online payment</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 text-lg"
        >
          {isPending
            ? "Processing..."
            : form.watch("paymentMethod") === "online"
              ? `Pay $${finalPrice.toFixed(2)} with Stripe`
              : `Confirm Booking - $${finalPrice.toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}
