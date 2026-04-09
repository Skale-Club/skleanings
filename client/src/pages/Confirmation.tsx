import { Link } from "wouter";
import { CheckCircle2, Home, Loader2, AlertCircle, CreditCard } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CompanySettings } from "@shared/schema";
import { trackPurchase } from "@/lib/analytics";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

export default function Confirmation() {
  const { items, totalPrice, clearCart } = useCart();
  const hasTracked = useRef(false);
  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const { settings } = useCompanySettings();
  const hc = (settings as any)?.homepageContent;
  const confirmation = { ...DEFAULT_HOMEPAGE_CONTENT.confirmationSection, ...(hc?.confirmationSection || {}) };

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session_id");
  const isStripeFlow = !!sessionId;

  const { data: verifyData, isLoading: isVerifying } = useQuery<{
    paid: boolean;
    bookingId: number | null;
    booking: any | null;
  }>({
    queryKey: ["/api/payments/verify", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/payments/verify/${sessionId}`);
      if (!res.ok) throw new Error("Failed to verify payment");
      return res.json();
    },
    enabled: isStripeFlow,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!hasTracked.current && items.length > 0) {
      const transactionId = `booking_${Date.now()}`;
      trackPurchase(
        transactionId,
        items.map(item => ({ id: item.id, name: item.name, price: Number(item.price), quantity: item.quantity })),
        totalPrice
      );
      hasTracked.current = true;
    }
    clearCart();
  }, []);

  // Stripe flow: loading
  if (isStripeFlow && isVerifying) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-slate-500">Verifying your payment...</p>
      </div>
    );
  }

  // Stripe flow: payment pending (paid: false)
  if (isStripeFlow && verifyData && !verifyData.paid) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg w-full animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Payment Pending</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Your booking has been created but payment has not been confirmed yet. If you completed payment, it may take a moment to process.
          </p>
          <Link href="/">
            <button className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Return Home
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Stripe flow: payment confirmed
  if (isStripeFlow && verifyData?.paid) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50">
        <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg w-full animate-in zoom-in duration-300">
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-semibold px-3 py-1.5 rounded-full mb-4">
            <CreditCard className="w-4 h-4" />
            Payment Received
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Booking Confirmed!</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Thank you for choosing {companySettings?.companyName}. {confirmation.paidMessage}
          </p>
          <div className="flex flex-col gap-4">
            <Link href="/">
              <button className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                <Home className="w-4 h-4" /> Return Home
              </button>
            </Link>
            <Link href="/services">
              <button className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
                Book Another Service
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Standard pay-on-site confirmation (no session_id)
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-slate-50">
      <div className="bg-white p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg w-full animate-in zoom-in duration-300">
        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-4">Booking Confirmed!</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Thank you for choosing {companySettings?.companyName}. {confirmation.sitePaymentMessage}
        </p>

        <div className="flex flex-col gap-4">
          <Link href="/">
            <button className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Return Home
            </button>
          </Link>
          <Link href="/services">
            <button className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
              Book Another Service
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
