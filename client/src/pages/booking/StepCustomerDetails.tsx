import type { UseFormReturn } from 'react-hook-form';
import type { BookingFormValues } from './bookingSchema';
import { ChevronRight, ArrowLeft } from 'lucide-react';

interface StepCustomerDetailsProps {
  form: UseFormReturn<BookingFormValues>;
  onNext: () => void;
  onBack: () => void;
}

export function StepCustomerDetails({
  form,
  onNext,
  onBack,
}: StepCustomerDetailsProps): JSX.Element {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold">Contact Details</h2>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Full Name</label>
            <input
              {...form.register("customerName")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="John Doe"
            />
            {form.formState.errors.customerName && <p className="text-red-500 text-xs">{form.formState.errors.customerName.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              {...form.register("customerEmail")}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="john@example.com"
            />
            {form.formState.errors.customerEmail && <p className="text-red-500 text-xs">{form.formState.errors.customerEmail.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Phone Number</label>
          <input
            {...form.register("customerPhone")}
            onChange={(e) => {
              let value = e.target.value.replace(/\D/g, "");
              if (value.length > 10) value = value.slice(0, 10);

              let maskedValue = "";
              if (value.length > 0) {
                maskedValue = "(" + value.slice(0, 3);
                if (value.length > 3) {
                  maskedValue += ") " + value.slice(3, 6);
                }
                if (value.length > 6) {
                  maskedValue += "-" + value.slice(6, 10);
                }
              }
              e.target.value = maskedValue;
              form.setValue("customerPhone", maskedValue, { shouldValidate: true });
            }}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="(555) 123-4567"
          />
          {form.formState.errors.customerPhone && <p className="text-red-500 text-xs">{form.formState.errors.customerPhone.message}</p>}
        </div>

        <button
          type="button"
          onClick={async () => {
            const isValid = await form.trigger(["customerName", "customerEmail", "customerPhone"]);
            if (isValid) onNext();
          }}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
        >
          Continue to Address <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
