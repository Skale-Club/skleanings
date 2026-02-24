import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Redirect, useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  HelpCircle,
  Image,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Package,
  Puzzle,
  Search,
  Users,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAdminAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SidebarProvider } from '@/components/ui/sidebar';
import type { AdminSection, CompanySettingsData } from '@/components/admin/shared/types';
import { AdminSidebar, type AdminMenuItem } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { DashboardSection } from '@/components/admin/DashboardSection';
import { CategoriesSection } from '@/components/admin/CategoriesSection';
import { ServicesSection } from '@/components/admin/ServicesSection';
import { BookingsSection } from '@/components/admin/BookingsSection';
import { HeroSettingsSection } from '@/components/admin/HeroSettingsSection';
import { CompanySettingsSection } from '@/components/admin/CompanySettingsSection';
import { SEOSection } from '@/components/admin/SEOSection';
import { FaqsSection } from '@/components/admin/FaqsSection';
import { UsersSection } from './admin/UsersSection';
import { AvailabilitySection } from '@/components/admin/AvailabilitySection';
import { AdminChatLayout } from '@/components/chat/admin/AdminChatLayout';
import { IntegrationsSection } from '@/components/admin/IntegrationsSection';
import { BlogSection } from '@/components/admin/BlogSection';

const menuItems: AdminMenuItem[] = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard },
  { id: 'company', title: 'Company Infos', icon: Building2 },
  { id: 'hero', title: 'Website', icon: Image },
  { id: 'categories', title: 'Categories', icon: FolderOpen },
  { id: 'services', title: 'Services', icon: Package },
  { id: 'bookings', title: 'Bookings', icon: Calendar },
  { id: 'availability', title: 'Availability', icon: Clock },
  { id: 'chat', title: 'Chat', icon: MessageSquare },
  { id: 'faqs', title: 'FAQs', icon: HelpCircle },
  { id: 'users', title: 'Users', icon: Users },
  { id: 'blog', title: 'Blog', icon: FileText },
  { id: 'seo', title: 'SEO', icon: Search },
  { id: 'integrations', title: 'Integrations', icon: Puzzle },
];

function AdminContent() {
  const { toast } = useToast();
  const { isAdmin, email, loading, signOut, getAccessToken } = useAdminAuth();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/admin/:section?');
  const sectionFromUrl = params?.section as AdminSection | undefined;
  const activeSection: AdminSection = sectionFromUrl && menuItems.some((i) => i.id === sectionFromUrl)
    ? sectionFromUrl
    : 'dashboard';

  const [blogResetSignal, setBlogResetSignal] = useState(0);
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map((item) => item.id));

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

  if (!loading && !isAdmin) {
    return <Redirect to="/admin/login" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-svh w-full bg-background relative overflow-hidden">
      <AdminSidebar
        companySettings={companySettings}
        email={email}
        menuItems={menuItems}
        sectionsOrder={sectionsOrder}
        activeSection={activeSection}
        onSectionSelect={handleSectionSelect}
        onSectionsReorder={updateSectionOrder}
        onLogout={async () => {
          await signOut();
          setLocation('/admin/login');
        }}
      />

      <main className="flex-1 min-w-0 min-h-0 relative bg-background overflow-y-auto overscroll-contain" id="admin-top">
        <AdminHeader companyName={companySettings?.companyName} />
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
          {activeSection === 'categories' && <CategoriesSection getAccessToken={getAccessToken} />}
          {activeSection === 'services' && <ServicesSection getAccessToken={getAccessToken} />}
          {activeSection === 'bookings' && <BookingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'hero' && <HeroSettingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'company' && <CompanySettingsSection getAccessToken={getAccessToken} />}
          {activeSection === 'seo' && <SEOSection getAccessToken={getAccessToken} />}
          {activeSection === 'faqs' && <FaqsSection />}
          {activeSection === 'users' && <UsersSection />}
          {activeSection === 'availability' && <AvailabilitySection />}
          {activeSection === 'chat' && <AdminChatLayout getAccessToken={getAccessToken} />}
          {activeSection === 'integrations' && <IntegrationsSection getAccessToken={getAccessToken} />}
          {activeSection === 'blog' && <BlogSection resetSignal={blogResetSignal} getAccessToken={getAccessToken} />}
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
