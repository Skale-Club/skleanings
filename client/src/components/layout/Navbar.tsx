import { Link, useLocation } from "wouter";
import { useCart } from "@/context/CartContext";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { ShoppingBag, Menu, X, Phone } from "lucide-react";
import { useState, useCallback } from "react";
import { clsx } from "clsx";
import { trackCallClick } from "@/lib/analytics";

export function Navbar() {
  const [location] = useLocation();
  const { items } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { settings: companySettings } = useCompanySettings();

  // Use data from settings - no hardcoded fallbacks
  const displayPhone = companySettings?.companyPhone || '';
  const telPhone = displayPhone.replace(/\D/g, '');

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/#areas-served", label: "Areas Served" },
    { href: "/blog", label: "Blog" },
    { href: "/faq", label: "FAQ" },
  ];

  const handleHashNavigation = useCallback((hash: string) => {
    if (location === '/') {
      // Already on home page: update hash so late-loaded content can re-align
      window.history.replaceState(null, '', `/#${hash}`);
      // Then scroll to the element
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Navigate to home page first, then scroll after page loads
      window.location.href = `/#${hash}`;
    }
  }, [location]);

  return (
    <nav className="relative overflow-hidden bg-white/60 backdrop-blur-[28px] backdrop-saturate-200 backdrop-brightness-110 backdrop-contrast-110 sticky top-0 z-50 border-b border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent opacity-65"></div>
      <div className="pointer-events-none absolute -top-6 left-0 h-16 w-full bg-[radial-gradient(120%_100%_at_20%_0%,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.28)_35%,rgba(255,255,255,0)_70%)] opacity-65 blur-lg"></div>
      <div className="container-custom mx-auto relative z-10">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Company Name */}
          <Link href="/" className="flex items-center gap-2">
            {companySettings?.logoMain ? (
              <img
                src={companySettings.logoMain}
                alt={companySettings.companyName || ''}
                className="h-[27px] md:h-9 w-auto"
              />
            ) : companySettings?.companyName ? (
              <span className="text-xl md:text-2xl font-bold text-[#1D1D1D]">
                {companySettings.companyName}
              </span>
            ) : null}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">Services</Link>
            <button
              onClick={() => handleHashNavigation('areas-served')}
              className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer"
            >
              Areas Served
            </button>
            <Link href="/blog" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">Blog</Link>
            <Link href="/faq" className="text-sm font-semibold text-[#1D1D1D] hover:text-primary transition-colors cursor-pointer">FAQ</Link>

            {displayPhone && (
              <a
                href={`tel:${telPhone}`}
                onClick={() => trackCallClick('header', displayPhone)}
                className="px-4 py-2 bg-secondary text-secondary-foreground font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2"
              >
                <Phone className="w-4 h-4 fill-current" />
                {displayPhone}
              </a>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-slate-600"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 py-6 px-6 flex flex-col gap-6 animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
          <div className="flex flex-col gap-5">
            {navLinks.map((link) => {
              const isHashLink = link.href.startsWith("/#");
              const Content = (
                <span className="text-lg font-semibold text-slate-700 hover:text-primary transition-colors">
                  {link.label}
                </span>
              );

              if (isHashLink) {
                const hash = link.href.replace("/#", "");
                return (
                  <button
                    key={link.href}
                    className="block text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleHashNavigation(hash);
                    }}
                  >
                    {Content}
                  </button>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {Content}
                </Link>
              );
            })}
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-col gap-6">
            <Link href="/booking" onClick={() => setIsMenuOpen(false)}>
              <div className="flex items-center gap-3 text-primary font-bold text-lg">
                <ShoppingBag className="w-6 h-6" />
                <span>Cart ({items.length})</span>
              </div>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
