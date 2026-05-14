import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Redirect, useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  BookUser,
  Building2,
  Calendar,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  HelpCircle,
  Image,
  LayoutDashboard,
  Loader2,
  MailCheck,
  MessageSquare,
  Package,
  Puzzle,
  Search,
  Users,
  X,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useAdminTenantAuth } from '@/context/AdminTenantAuthContext';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { AdminSection, CompanySettingsData } from '@/components/admin/shared/types';
import { AdminSidebar, type AdminMenuItem } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CalendarReconnectBanner } from '@/components/admin/CalendarReconnectBanner';
import { DashboardSection } from '@/components/admin/DashboardSection';
import { CategoriesSection } from '@/components/admin/CategoriesSection';
import { ServicesSection } from '@/components/admin/ServicesSection';
import { BookingsSection } from '@/components/admin/BookingsSection';
import { HeroSettingsSection } from '@/components/admin/HeroSettingsSection';
import { CompanySettingsSection } from '@/components/admin/CompanySettingsSection';
import { SEOSection } from '@/components/admin/SEOSection';
import { FaqsSection } from '@/components/admin/FaqsSection';
import { UnifiedUsersSection } from '@/components/admin/UnifiedUsersSection';
import { AvailabilitySection } from '@/components/admin/AvailabilitySection';
import { AdminChatLayout } from '@/components/chat/admin/AdminChatLayout';
import { IntegrationsSection } from '@/components/admin/IntegrationsSection';
import { BlogSection } from '@/components/admin/BlogSection';
import { MarketingSection } from '@/components/admin/MarketingSection';
import { AppointmentsCalendarSection } from '@/components/admin/AppointmentsCalendarSection';
import { ContactsSection } from '@/components/admin/ContactsSection';
import { useMe } from '@/hooks/useMe';

const menuItems: AdminMenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'calendar', title: 'Calendar', icon: CalendarDays },
  { id: 'contacts', title: 'Contacts', icon: BookUser },
  { id: 'company', title: 'Company Infos', icon: Building2 },
  { id: 'hero', title: 'Website', icon: Image },
  { id: 'categories', title: 'Categories', icon: FolderOpen },
  { id: 'services', title: 'Services', icon: Package },
  { id: 'bookings', title: 'Bookings', icon: Calendar },
  { id: 'marketing', title: 'Marketing', icon: BarChart2 },
  { id: 'availability', title: 'Availability', icon: Clock },
  { id: 'chat', title: 'Chat', icon: MessageSquare },
  { id: 'faqs', title: 'FAQs', icon: HelpCircle },
  { id: 'users', title: 'Users', icon: Users },
  { id: 'blog', title: 'Blog', icon: FileText },
  { id: 'seo', title: 'SEO', icon: Search },
  { id: 'integrations', title: 'Integrations', icon: Puzzle },
  { id: 'billing', title: 'Billing', icon: CreditCard },
];

function AdminContent() {
  const { toast } = useToast();
  const { isAuthenticated, loading: tenantAuthLoading, email: tenantEmail, logout: tenantLogout, emailVerifiedAt } = useAdminTenantAuth();
  const { getAccessToken } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/:section?/:tab?');
  const sectionFromUrl = params?.section as AdminSection | undefined;
  const activeSection: AdminSection = sectionFromUrl && menuItems.some((i) => i.id === sectionFromUrl)
    ? sectionFromUrl
    : 'dashboard';

  const { isAdmin: roleIsAdmin, isStaff, staffMemberId: myStaffMemberId } = useMe();

  const STAFF_ALLOWED_SECTIONS: AdminSection[] = ['dashboard', 'calendar'];

  const [blogResetSignal, setBlogResetSignal] = useState(0);
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map((item) => item.id));
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);

  const handleResendVerification = async () => {
    try {
      await fetch('/api/auth/resend-verification', { method: 'POST', credentials: 'include' });
      toast({ title: 'Verification email sent', description: 'Check your inbox for a new link.' });
    } catch {
      toast({ title: 'Verification email sent', description: 'Check your inbox for a new link.' });
    }
  };

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  useEffect(() => {
    if (companySettings?.sectionsOrder && companySettings.sectionsOrder.length > 0) {
      const savedOrder = companySettings.sectionsOrder as AdminSection[];
      const allSectionIds = menuItems.map((item) => item.id);
      const validSaved = savedOrder.filter((id) => allSectionIds.includes(id));
      const missingSections = allSectionIds.filter((id) => !validSaved.includes(id));
      setSectionsOrder([...validSaved, ...missingSections]);
    }
  }, [companySettings?.sectionsOrder]);

  const updateSectionOrder = useCallback(async (newOrder: AdminSection[]) => {
    setSectionsOrder(newOrder);
    try {
      await apiRequest('PUT', '/api/company-settings', { sectionsOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      toast({
        title: 'Error saving section order',
        description: error.message,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleSectionSelect = useCallback((section: AdminSection) => {
    if (section === 'dashboard') {
      setLocation('/admin');
    } else {
      setLocation(`/admin/${section}`);
    }
    if (section === 'blog' && activeSection === 'blog') {
      setBlogResetSignal((prev) => prev + 1);
    }
  }, [activeSection, setLocation]);

  if (tenantAuthLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/admin/login" />;
  }

  return (
    <div className="flex h-svh w-full bg-background relative overflow-hidden">
      <AdminSidebar
        companySettings={companySettings}
        email={tenantEmail}
        menuItems={menuItems}
        sectionsOrder={isStaff ? sectionsOrder.filter(id => STAFF_ALLOWED_SECTIONS.includes(id as AdminSection)) : sectionsOrder}
        activeSection={activeSection}
        onSectionSelect={handleSectionSelect}
        onSectionsReorder={updateSectionOrder}
        onLogout={async () => {
          await tenantLogout();
          setLocation('/admin/login');
        }}
      />

      <main className="flex-1 min-w-0 min-h-0 relative bg-background overflow-y-auto overscroll-contain" id="admin-top">
        <AdminHeader companyName={companySettings?.companyName} />
        {activeSection !== 'chat' && <CalendarReconnectBanner getAccessToken={getAccessToken} />}
        {activeSection !== 'chat' && !emailVerifiedAt && !verifyBannerDismissed && (
          <div className="flex items-center gap-3 px-6 py-3 bg-yellow-50 border-b border-yellow-200 text-sm text-yellow-900">
            <MailCheck className="w-4 h-4 shrink-0 text-yellow-600" />
            <span className="flex-1">
              <strong>Please verify your email</strong> — check your inbox for a verification link.
              <button
                onClick={handleResendVerification}
                className="ml-2 underline font-medium hover:text-yellow-700"
              >
                Resend verification email
              </button>
            </span>
            <button
              onClick={() => setVerifyBannerDismissed(true)}
              className="p-1 rounded hover:bg-yellow-100"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-yellow-600" />
            </button>
          </div>
        )}
        <div className={activeSection === 'chat' ? 'min-h-0 p-0' : 'min-h-0 p-6 sm:p-6 md:p-8 pb-8'}>
          {activeSection === 'dashboard' && (
            <DashboardSection
              getAccessToken={getAccessToken}
              goToBookings={() => {
                if (!sectionsOrder.includes('bookings')) {
                  setSectionsOrder((prev) => [...prev, 'bookings']);
                }
                setLocation('/admin/bookings');
                document.getElementById('admin-top')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}
          {activeSection === 'calendar' && (
            <AppointmentsCalendarSection
              getAccessToken={getAccessToken}
              staffMemberId={isStaff ? myStaffMemberId : null}
            />
          )}
          {activeSection === 'contacts' && <ContactsSection />}
          {activeSection === 'categories' && <CategoriesSection getAccessToken={getAccessToken} />}
          {activeSection === 'services' && <ServicesSection getAccessToken={getAccessToken} />}
          {activeSection === 'bookings' && <BookingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'hero' && <HeroSettingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'company' && <CompanySettingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'seo' && <SEOSection getAccessToken={getAccessToken} />}
          {activeSection === 'faqs' && <FaqsSection />}
          {activeSection === 'users' && <UnifiedUsersSection />}
          {activeSection === 'availability' && <AvailabilitySection />}
          {activeSection === 'chat' && <AdminChatLayout getAccessToken={getAccessToken} />}
          {activeSection === 'integrations' && <IntegrationsSection getAccessToken={getAccessToken} />}
          {activeSection === 'blog' && <BlogSection resetSignal={blogResetSignal} getAccessToken={getAccessToken} />}
          {activeSection === 'marketing' && <MarketingSection getAccessToken={getAccessToken} />}
          {activeSection === 'billing' && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">
                Visit <a href="/admin/billing" className="underline text-primary">/admin/billing</a> to manage billing.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Admin() {
  const sidebarStyle = {
    '--sidebar-width': '16rem',
    '--sidebar-width-icon': '3rem',
  };

  return (
    <SidebarProvider style={sidebarStyle as CSSProperties}>
      <AdminContent />
    </SidebarProvider>
  );
}
