import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAdminAuth } from '@/context/AuthContext';
import { useLocation, useRoute, Link, Redirect } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest, authenticatedRequest } from '@/lib/queryClient';
import BlogSettings from './admin/BlogSettings';
import { renderMarkdown, markdownToHtml } from '@/lib/markdown';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Camera,
  LogOut,
  FolderOpen,
  Package,
  Calendar,
  Clock,
  DollarSign,
  User,
  MapPin,
  Image,
  LayoutDashboard,
  Building2,
  GripVertical,
  ArrowLeft,
  Check,
  Users,
  Puzzle,
  Globe,
  Search,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  MessageSquare,
  Archive,
  RotateCcw,
  Tag,
  Star,
  Shield,
  Sparkles,
  Heart,
  BadgeCheck,
  ThumbsUp,
  Trophy,
  Moon,
  Sun,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  MoreVertical,
  Settings,
  Bot
} from 'lucide-react';
import { DEFAULT_CHAT_OBJECTIVES, type IntakeObjective, type ChatSettingsData } from '@/components/chat/admin/types';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clsx } from 'clsx';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/context/ThemeContext';
import type { Category, Service, Booking, Subcategory, Faq, BlogPost, HomepageContent, ServiceArea, ServiceAreaGroup, ServiceAreaCity } from '@shared/schema';
import { HelpCircle, FileText, AlertCircle, ExternalLink } from 'lucide-react';

const ghlLogo = 'https://lsrlnlcdrshzzhqvklqc.supabase.co/storage/v1/object/public/skleanings/ghl-logo.webp';
import { SiFacebook, SiGoogleanalytics, SiGoogletagmanager, SiGooglegemini, SiOpenai, SiTwilio } from 'react-icons/si';
import { AdminChatLayout } from '@/components/chat/admin/AdminChatLayout';
import { UsersSection } from "./admin/UsersSection";

type AdminSection = 'dashboard' | 'categories' | 'services' | 'bookings' | 'hero' | 'company' | 'seo' | 'faqs' | 'users' | 'availability' | 'chat' | 'integrations' | 'blog';

const menuItems = [
  { id: 'dashboard' as AdminSection, title: 'Dashboard', icon: LayoutDashboard },
  { id: 'company' as AdminSection, title: 'Company Infos', icon: Building2 },
  { id: 'hero' as AdminSection, title: 'Website', icon: Image },
  { id: 'categories' as AdminSection, title: 'Categories', icon: FolderOpen },
  { id: 'services' as AdminSection, title: 'Services', icon: Package },
  { id: 'bookings' as AdminSection, title: 'Bookings', icon: Calendar },
  { id: 'availability' as AdminSection, title: 'Availability', icon: Clock },
  { id: 'chat' as AdminSection, title: 'Chat', icon: MessageSquare },
  { id: 'faqs' as AdminSection, title: 'FAQs', icon: HelpCircle },
  { id: 'users' as AdminSection, title: 'Users', icon: Users },
  { id: 'blog' as AdminSection, title: 'Blog', icon: FileText },
  { id: 'seo' as AdminSection, title: 'SEO', icon: Search },
  { id: 'integrations' as AdminSection, title: 'Integrations', icon: Puzzle },
];



function AdminContent() {
  const { toast } = useToast();
  const { isAdmin, email, firstName, lastName, loading, signOut, getAccessToken } = useAdminAuth();
  const [location, setLocation] = useLocation();
  // Match /admin or /admin/:section
  const [, params] = useRoute('/admin/:section?');
  const sectionFromUrl = params?.section as AdminSection | undefined;
  const [blogResetSignal, setBlogResetSignal] = useState(0);
  const [sectionsOrder, setSectionsOrder] = useState<AdminSection[]>(menuItems.map(item => item.id));
  const { toggleSidebar } = useSidebar();
  const sidebarSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Default to dashboard if no section in URL
  const activeSection: AdminSection = sectionFromUrl && menuItems.some(i => i.id === sectionFromUrl)
    ? sectionFromUrl
    : 'dashboard';

  // Redirect to login if not authenticated
  if (!loading && !isAdmin) {
    return <Redirect to="/admin/login" />;
  }

  const updateSectionOrder = useCallback(async (newOrder: AdminSection[]) => {
    setSectionsOrder(newOrder);
    try {
      await apiRequest('PUT', '/api/company-settings', { sectionsOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    } catch (error: any) {
      toast({
        title: 'Error saving section order',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Navegação: muda a URL para a seção
  const handleSectionSelect = useCallback((section: AdminSection) => {
    if (section === 'dashboard') {
      setLocation('/admin');
    } else {
      setLocation(`/admin/${section}`);
    }
    if (section === 'blog') {
      if (activeSection === 'blog') {
        setBlogResetSignal(prev => prev + 1);
      }
    }
  }, [activeSection, setLocation]);

  const handleSidebarDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSectionsOrder(prev => {
      const oldIndex = prev.indexOf(active.id as AdminSection);
      const newIndex = prev.indexOf(over.id as AdminSection);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      updateSectionOrder(reordered);
      return reordered;
    });
  };

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (companySettings?.sectionsOrder && companySettings.sectionsOrder.length > 0) {
      const savedOrder = companySettings.sectionsOrder as AdminSection[];
      const allSectionIds = menuItems.map(item => item.id);
      const validSaved = savedOrder.filter(id => allSectionIds.includes(id));
      const missingSections = allSectionIds.filter(id => !validSaved.includes(id));
      setSectionsOrder([...validSaved, ...missingSections]);
    }
  }, [companySettings?.sectionsOrder]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    setLocation('/admin/login');
  };

  return (
    <div className="flex h-svh w-full bg-background relative overflow-hidden">
      <Sidebar className="border-r border-sidebar-border bg-sidebar">
        <SidebarHeader className="p-4 border-b border-sidebar-border bg-sidebar">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors group">
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              Back to website
            </Link>
            <div className="flex items-center gap-3">
              {companySettings?.logoIcon ? (
                <img
                  src={companySettings.logoIcon}
                  alt={companySettings.companyName || 'Logo'}
                  className="w-10 h-10 object-contain"
                  data-testid="img-admin-logo"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {companySettings?.companyName?.[0] || 'A'}
                </div>
              )}
              <span className="font-semibold text-lg text-primary truncate">
                {companySettings?.companyName || 'Admin Panel'}
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2 bg-sidebar">
          <SidebarGroup>
            <SidebarGroupContent>
              <DndContext
                sensors={sidebarSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleSidebarDragEnd}
              >
                <SortableContext items={sectionsOrder} strategy={verticalListSortingStrategy}>
                  <SidebarMenu>
                    {sectionsOrder.map((sectionId) => {
                      const item = menuItems.find(i => i.id === sectionId)!;
                      return (
                        <SidebarSortableItem
                          key={item.id}
                          item={item}
                          isActive={activeSection === item.id}
                          onSelect={() => handleSectionSelect(item.id)}
                        />
                      );
                    })}
                  </SidebarMenu>
                </SortableContext>
              </DndContext>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4 border-t border-border mt-auto bg-sidebar">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">Logged in as</p>
                <p className="font-medium truncate text-foreground">{email}</p>
              </div>
              <ThemeToggle variant="icon" className="text-muted-foreground hover:text-foreground" />
            </div>
            <Button
              variant="default"
              className="w-full"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 min-w-0 min-h-0 relative bg-background overflow-y-auto overscroll-contain" id="admin-top">
        <header className="md:hidden sticky top-0 z-50 bg-card border-b border-border p-4 flex items-center gap-4">
          <SidebarTrigger className="bg-card shadow-sm border border-border rounded-lg p-2 h-10 w-10 shrink-0" />
          <button
            type="button"
            className="font-semibold text-primary select-none text-left"
            onClick={toggleSidebar}
          >
            {companySettings?.companyName || 'Skleanings'}
          </button>
        </header>
        <div className={clsx("min-h-0", activeSection === 'chat' ? "p-0" : "p-6 sm:p-6 md:p-8 pb-8")}>
          {activeSection === 'dashboard' && (
            <DashboardSection
              goToBookings={() => {
                if (!sectionsOrder.includes('bookings')) {
                  setSectionsOrder(prev => [...prev, 'bookings']);
                }
                setLocation('/admin/bookings');
                document.getElementById('admin-top')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          )}
          {activeSection === 'categories' && <CategoriesSection getAccessToken={getAccessToken} />}
          {activeSection === 'services' && <ServicesSection getAccessToken={getAccessToken} />}
          {activeSection === 'bookings' && <BookingsSection />}
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
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <AdminContent />
    </SidebarProvider>
  );
}

function DashboardSection({ goToBookings }: { goToBookings: () => void }) {
  const { data: categories } = useQuery<Category[]>({ queryKey: ['/api/categories'] });
  const { data: services } = useQuery<Service[]>({ queryKey: ['/api/services'] });
  const { data: bookings } = useQuery<Booking[]>({ queryKey: ['/api/bookings'] });
  const dashboardMenuTitle = menuItems.find((item) => item.id === 'dashboard')?.title ?? 'Dashboard';
  const [recentBookingsView, setRecentBookingsView] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const recentBookings = useMemo(() => {
    const list = bookings || [];
    if (list.length === 0) return [];
    const now = new Date();

    const filtered = list.filter((booking) => {
      const time = booking.endTime || booking.startTime || '00:00';
      const dateTime = new Date(`${booking.bookingDate}T${time}`);
      const bookingIsPast = Number.isNaN(dateTime.getTime())
        ? new Date(booking.bookingDate) < now
        : dateTime < now;

      if (recentBookingsView === 'all') return true;
      if (recentBookingsView === 'past') return bookingIsPast;
      return !bookingIsPast;
    });

    return filtered.slice(0, 5);
  }, [bookings, recentBookingsView]);

  const stats = [
    { label: 'Total Categories', value: categories?.length || 0, icon: FolderOpen, color: 'text-blue-500' },
    { label: 'Total Services', value: services?.length || 0, icon: Package, color: 'text-green-500' },
    { label: 'Total Bookings', value: bookings?.length || 0, icon: Calendar, color: 'text-purple-500' },
    { label: 'Revenue', value: `$${bookings?.reduce((sum, b) => sum + Number(b.totalPrice), 0).toFixed(2) || '0.00'}`, icon: DollarSign, color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{dashboardMenuTitle}</h1>
        <p className="text-muted-foreground">Overview of your cleaning business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-muted p-6 rounded-lg transition-all hover:bg-muted/80">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-card/70 flex items-center justify-center">
                <stat.icon className={clsx("w-6 h-6", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-muted rounded-lg overflow-hidden">
        <div className="p-6 pb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Recent Bookings
          </h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select value={recentBookingsView} onValueChange={(value) => setRecentBookingsView(value as 'upcoming' | 'past' | 'all')}>
              <SelectTrigger className="h-9 w-full sm:w-[140px] text-xs bg-card/70 border-0 font-semibold" data-testid="select-recent-bookings-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={goToBookings}>
              Go to Bookings
            </Button>
          </div>
        </div>
        <div className="px-6 pb-6">
          {bookings?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings yet</p>
          ) : recentBookings.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No bookings in this view</p>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((booking) => (
                <RecentBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentBookingCard({ booking }: { booking: Booking }) {
  const [expanded, setExpanded] = useState(false);
  const { data: bookingItems, isLoading } = useBookingItems(booking.id, expanded);

  return (
    <div className="rounded-lg bg-card/70 dark:bg-slate-900/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium truncate">{booking.customerName}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(booking.bookingDate), "MMM dd, yyyy")} • {booking.startTime} - {booking.endTime}
          </p>
          <p className="text-xs text-muted-foreground truncate">{booking.customerAddress}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((prev) => !prev)}
            data-testid={`button-toggle-recent-booking-${booking.id}`}
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", expanded && "rotate-180")} />
            {expanded ? 'Hide services' : 'Show services'}
          </Button>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end sm:text-right">
          <p className="text-2xl sm:text-xl font-bold">${booking.totalPrice}</p>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <Badge
              variant={booking.status === 'confirmed' ? 'default' : booking.status === 'completed' ? 'secondary' : 'destructive'}
              className="text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center capitalize"
            >
              {booking.status}
            </Badge>
            <Badge
              className={`text-xs font-semibold leading-5 px-3 py-1 min-w-[88px] justify-center border ${booking.paymentStatus === 'paid'
                ? 'border-primary/30 bg-primary/10 text-primary dark:border-primary/40 dark:bg-primary/20'
                : 'border-border bg-muted text-muted-foreground'
                }`}
            >
              {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
            </Badge>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/60">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading services...
            </div>
          ) : bookingItems && bookingItems.length > 0 ? (
            <ul className="space-y-1">
              {bookingItems.map((item) => (
                <li key={item.id} className="text-xs flex items-center justify-between">
                  <span className="truncate">{item.serviceName}{item.quantity && item.quantity > 1 ? ` x${item.quantity}` : ''}</span>
                  <span className="font-medium text-foreground">${item.price}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No services listed</p>
          )}
        </div>
      )}
    </div>
  );
}

function HeroSettingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });
  const heroMenuTitle = menuItems.find((item) => item.id === 'hero')?.title ?? 'Hero Section';

  const HERO_DEFAULTS = {
    title: '',
    subtitle: '',
    ctaText: '',
    image: '',
  };

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});
  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
    ) : null
  );

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.heroTitle || HERO_DEFAULTS.title);
      setHeroSubtitle(settings.heroSubtitle || HERO_DEFAULTS.subtitle);
      setHeroImageUrl(settings.heroImageUrl || HERO_DEFAULTS.image);
      setCtaText(settings.ctaText || HERO_DEFAULTS.ctaText);
      setHomepageContent({
        ...DEFAULT_HOMEPAGE_CONTENT,
        ...(settings.homepageContent || {}),
        trustBadges: settings.homepageContent?.trustBadges?.length
          ? settings.homepageContent.trustBadges
          : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
        categoriesSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
          ...(settings.homepageContent?.categoriesSection || {}),
        },
        reviewsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
          ...(settings.homepageContent?.reviewsSection || {}),
        },
        blogSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
          ...(settings.homepageContent?.blogSection || {}),
        },
        areasServedSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
          ...(settings.homepageContent?.areasServedSection || {}),
        },
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!isLoading && !settings) {
      setHeroTitle('');
      setHeroSubtitle('');
      setHeroImageUrl('');
      setCtaText('');
      setHomepageContent(DEFAULT_HOMEPAGE_CONTENT);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const trustBadges = homepageContent.trustBadges || [];
  const badgeIconOptions = [
    { label: 'Star', value: 'star', icon: Star },
    { label: 'Shield', value: 'shield', icon: Shield },
    { label: 'Clock', value: 'clock', icon: Clock },
    { label: 'Sparkles', value: 'sparkles', icon: Sparkles },
    { label: 'Heart', value: 'heart', icon: Heart },
    { label: 'Badge Check', value: 'badgeCheck', icon: BadgeCheck },
    { label: 'Thumbs Up', value: 'thumbsUp', icon: ThumbsUp },
    { label: 'Trophy', value: 'trophy', icon: Trophy },
  ];
  const categoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };
  const reviewsSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(homepageContent.reviewsSection || {}),
  };
  const blogSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(homepageContent.blogSection || {}),
  };
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };

  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) {
        clearTimeout(savedFieldTimers.current[field]);
      }
      savedFieldTimers.current[field] = setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 3000);
    });
  }, []);

  const saveHeroSettings = useCallback(async (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      await authenticatedRequest('PUT', '/api/company-settings', token, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      const keysToMark = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(updates);
      if (keysToMark.length > 0) {
        markFieldsSaved(keysToMark);
      }
    } catch (error: any) {
      toast({
        title: 'Error saving hero settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveHeroSettings(updates, fieldKeys);
    }, 800);
  }, [saveHeroSettings]);

  const updateHomepageContent = useCallback((updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => {
    setHomepageContent(prev => {
      const updated = updater(prev);
      triggerAutoSave({ homepageContent: updated }, fieldKey ? [fieldKey] : ['homepageContent']);
      return updated;
    });
  }, [triggerAutoSave]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      console.log('Token retrieved:', token ? 'Present' : 'Missing');
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      setHeroImageUrl(objectPath);
      await saveHeroSettings({ heroImageUrl: objectPath }, ['heroImageUrl']);
      toast({ title: 'Hero image uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{heroMenuTitle}</h1>
          <p className="text-muted-foreground">Customize hero and homepage content</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-muted p-6 rounded-lg transition-all space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Section
          </h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroTitle">Hero Title</Label>
              <div className="relative">
                <Input
                  id="heroTitle"
                  value={heroTitle}
                  onChange={(e) => {
                    setHeroTitle(e.target.value);
                    triggerAutoSave({ heroTitle: e.target.value }, ['heroTitle']);
                  }}
                  placeholder="Enter hero title"
                  data-testid="input-hero-title"
                />
                <SavedIndicator field="heroTitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
              <div className="relative">
                <Textarea
                  id="heroSubtitle"
                  value={heroSubtitle}
                  onChange={(e) => {
                    setHeroSubtitle(e.target.value);
                    triggerAutoSave({ heroSubtitle: e.target.value }, ['heroSubtitle']);
                  }}
                  placeholder="Enter hero subtitle"
                  data-testid="input-hero-subtitle"
                  className="min-h-[120px]"
                />
                <SavedIndicator field="heroSubtitle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">Call to Action Button Text</Label>
              <div className="relative">
                <Input
                  id="ctaText"
                  value={ctaText}
                  onChange={(e) => {
                    setCtaText(e.target.value);
                    triggerAutoSave({ ctaText: e.target.value }, ['ctaText']);
                  }}
                  placeholder="Book Now"
                  data-testid="input-cta-text"
                />
                <SavedIndicator field="ctaText" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="heroImage">Hero Image</Label>
              <div className="flex flex-col gap-3">
                <div className="aspect-[4/3] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                  {heroImageUrl ? (
                    <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Background Image</p>
                    </div>
                  )}
                  <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    <Plus className="w-8 h-8 text-white" />
                  </label>
                </div>
                <div className="flex gap-2 max-w-xs">
                  <div className="relative w-full">
                    <Input
                      value={heroImageUrl}
                      onChange={(e) => {
                        setHeroImageUrl(e.target.value);
                        triggerAutoSave({ heroImageUrl: e.target.value }, ['heroImageUrl']);
                      }}
                      placeholder="Or enter image URL (https://...)"
                      data-testid="input-hero-image"
                    />
                    <SavedIndicator field="heroImageUrl" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            Hero Badge
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Badge Image URL</Label>
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Input
                    value={homepageContent.heroBadgeImageUrl || ''}
                    onChange={(e) =>
                      updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: e.target.value }), 'homepageContent.heroBadgeImageUrl')
                    }
                    placeholder="https://..."
                  />
                  <SavedIndicator field="homepageContent.heroBadgeImageUrl" />
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const token = await getAccessToken();
                        if (!token) {
                          toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
                          return;
                        }
                        const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
                        const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
                        await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                        updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }), 'homepageContent.heroBadgeImageUrl');
                        setHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }));
                        triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: objectPath } }, ['homepageContent.heroBadgeImageUrl']);
                        toast({ title: 'Badge uploaded and saved' });
                      } catch (error: any) {
                        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                      } finally {
                        if (e.target) {
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Badge Alt Text</Label>
              <div className="relative">
                <Input
                  value={homepageContent.heroBadgeAlt || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')
                  }
                  placeholder="Trusted Experts"
                />
                <SavedIndicator field="homepageContent.heroBadgeAlt" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Badge Icon</Label>
              <Select
                value={homepageContent.trustBadges?.[0]?.icon || 'star'}
                onValueChange={(value) => {
                  updateHomepageContent(prev => {
                    const badges = [...(prev.trustBadges || DEFAULT_HOMEPAGE_CONTENT.trustBadges || [])];
                    badges[0] = { ...(badges[0] || {}), icon: value };
                    return { ...prev, trustBadges: badges };
                  }, 'homepageContent.trustBadges.0.icon');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {badgeIconOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Trust Badges
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                trustBadges: [...(prev.trustBadges || []), { title: 'New Badge', description: '' }],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Add badge
          </Button>
        </div>
        <div className="space-y-4">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] items-start bg-card p-3 rounded-lg border border-border"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input
                    value={badge.title}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          title: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.title`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.title`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="relative">
                  <Input
                    value={badge.description}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          description: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.description`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.description`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={badge.icon || badgeIconOptions[index % badgeIconOptions.length].value}
                  onValueChange={(value) =>
                    updateHomepageContent(prev => {
                      const updatedBadges = [...(prev.trustBadges || [])];
                      updatedBadges[index] = {
                        ...(updatedBadges[index] || { title: '', description: '' }),
                        icon: value,
                      };
                      return { ...prev, trustBadges: updatedBadges };
                    }, `homepageContent.trustBadges.${index}.icon`)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {badgeIconOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="w-4 h-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end items-start pt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateHomepageContent(prev => {
                      const updatedBadges = (prev.trustBadges || []).filter((_, i) => i !== index);
                      return { ...prev, trustBadges: updatedBadges };
                    })
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {trustBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">No badges added yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Categories Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={categoriesSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.title')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={categoriesSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.categoriesSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={categoriesSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Reviews Section
          </h2>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={reviewsSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.title')
                }
              />
              <SavedIndicator field="homepageContent.reviewsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={reviewsSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.reviewsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Review Widget Embed URL</Label>
            <div className="relative">
              <Input
                value={reviewsSection.embedUrl || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      embedUrl: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.embedUrl')
                }
                placeholder="https://..."
              />
              <SavedIndicator field="homepageContent.reviewsSection.embedUrl" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Blog Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={blogSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.blogSection.title')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={blogSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.blogSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.blogSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>View All Text</Label>
            <div className="relative">
              <Input
                value={blogSection.viewAllText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      viewAllText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.viewAllText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.viewAllText" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Card CTA Text</Label>
            <div className="relative">
              <Input
                value={blogSection.readMoreText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      readMoreText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.readMoreText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.readMoreText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Areas Served Section
          </h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={areasServedSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      label: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.label')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={areasServedSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      heading: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <div className="relative">
              <Textarea
                value={areasServedSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.description')
                }
                className="min-h-[120px]"
              />
              <SavedIndicator field="homepageContent.areasServedSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={areasServedSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.ctaText" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DayHours {
  isOpen: boolean;
  start: string;
  end: string;
}

interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { isOpen: true, start: '08:00', end: '18:00' },
  tuesday: { isOpen: true, start: '08:00', end: '18:00' },
  wednesday: { isOpen: true, start: '08:00', end: '18:00' },
  thursday: { isOpen: true, start: '08:00', end: '18:00' },
  friday: { isOpen: true, start: '08:00', end: '18:00' },
  saturday: { isOpen: false, start: '09:00', end: '14:00' },
  sunday: { isOpen: false, start: '09:00', end: '14:00' },
};

const INDUSTRY_OPTIONS = [
  'Cleaning',
  'Barbershop',
  'Beauty Salon',
  'Hairdresser',
  'Spa',
  'Fitness',
  'Home Services',
  'Automotive',
  'Other',
];

const normalizeIndustryValue = (value: string) => value.trim().toLowerCase();

const resolveIndustrySelection = (value?: string | null) => {
  if (!value) return '';
  const normalized = normalizeIndustryValue(value);
  const match = INDUSTRY_OPTIONS.find((option) => normalizeIndustryValue(option) === normalized);
  return match || 'Other';
};

interface CompanySettingsData {
  id?: number;
  companyName: string | null;
  industry: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  logoMain: string | null;
  logoDark: string | null;
  logoIcon: string | null;
  sectionsOrder: AdminSection[] | null;
  socialLinks: { platform: string; url: string }[] | null;
  mapEmbedUrl: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  ctaText: string | null;
  homepageContent: HomepageContent | null;
  timeFormat: string | null;
  timeZone: string | null;
  businessHours: BusinessHours | null;
  minimumBookingValue: string | null;
}

interface SEOSettingsData {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  seoCanonicalUrl: string | null;
  seoRobotsTag: string | null;
  ogType: string | null;
  ogSiteName: string | null;
  twitterCard: string | null;
  twitterSite: string | null;
  twitterCreator: string | null;
  schemaLocalBusiness: Record<string, any> | null;
}

function CompanySettingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettingsData>({
    companyName: 'Skleanings',
    industry: 'Cleaning',
    companyEmail: 'contact@skleanings.com',
    companyPhone: '',
    companyAddress: '',
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    logoMain: '',
    logoDark: '',
    logoIcon: '',
    sectionsOrder: null,
    socialLinks: [],
    mapEmbedUrl: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    ctaText: '',
    homepageContent: DEFAULT_HOMEPAGE_CONTENT,
    timeFormat: '12h',
    timeZone: 'America/New_York',
    businessHours: DEFAULT_BUSINESS_HOURS,
    minimumBookingValue: '0',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [industrySelection, setIndustrySelection] = useState<string>(resolveIndustrySelection('Cleaning'));
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
      setIndustrySelection(resolveIndustrySelection(fetchedSettings.industry));
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<CompanySettingsData>) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const updateField = useCallback(<K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'dark' | 'icon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Get access token for authentication
      const token = await getAccessToken(); // This should be available from useAdminAuth
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      // Use authenticated request to get upload URL
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      const fieldMap = { main: 'logoMain', dark: 'logoDark', icon: 'logoIcon' } as const;
      const fieldName = fieldMap[type];

      setSettings(prev => ({ ...prev, [fieldName]: objectPath }));
      await saveSettings({ [fieldName]: objectPath });

      toast({ title: 'Asset uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">Manage your business information and assets</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Auto-saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Business Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName || ''}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={industrySelection || resolveIndustrySelection(settings.industry)}
                  onValueChange={(value) => {
                    setIndustrySelection(value);
                    if (value === 'Other') {
                      if (resolveIndustrySelection(settings.industry) !== 'Other') {
                        setSettings((prev) => ({ ...prev, industry: '' }));
                        saveSettings({ industry: '' });
                      }
                      return;
                    }
                    setSettings((prev) => ({ ...prev, industry: value }));
                    saveSettings({ industry: value });
                  }}
                >
                  <SelectTrigger id="industry" data-testid="input-company-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {industrySelection === 'Other' && (
                  <Input
                    id="industry-custom"
                    value={settings.industry || ''}
                    onChange={(e) => updateField('industry', e.target.value)}
                    placeholder="Type industry"
                    data-testid="input-company-industry-custom"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Contact Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={settings.companyEmail || ''}
                  onChange={(e) => updateField('companyEmail', e.target.value)}
                  data-testid="input-company-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone Number</Label>
                <Input
                  id="companyPhone"
                  value={settings.companyPhone || ''}
                  onChange={(e) => updateField('companyPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  data-testid="input-company-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Business Address</Label>
                <Input
                  id="companyAddress"
                  value={settings.companyAddress || ''}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder="123 Main St, City, State"
                  data-testid="input-company-address"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mapEmbedUrl">Map Embed URL (Iframe src)</Label>
                <Input
                  id="mapEmbedUrl"
                  value={settings.mapEmbedUrl || ''}
                  onChange={(e) => updateField('mapEmbedUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?..."
                  data-testid="input-map-embed-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the iframe "src" attribute from Google Maps "Share -{'>'} Embed a map" to update the map shown on the home page.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Service Areas
            </h2>
            <p className="text-sm text-muted-foreground">Manage regions/counties where you provide services (e.g., MetroWest, Greater Boston)</p>
            <UnifiedServiceAreasManager />
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Branding Assets
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Main Logo (Light Mode)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group">
                    {settings.logoMain ? (
                      <img src={settings.logoMain} alt="Main Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Main Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'main')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dark Logo (Optional)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-slate-900 dark:bg-slate-100 flex items-center justify-center overflow-hidden relative group">
                    {settings.logoDark ? (
                      <img src={settings.logoDark} alt="Dark Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Dark Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'dark')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Favicon / App Icon</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group mx-auto">
                    {settings.logoIcon ? (
                      <img src={settings.logoIcon} alt="Icon" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-2">
                        <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">Icon</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'icon')} accept="image/*" />
                      <Plus className="w-6 h-6 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6 mt-2">
                <Label className="text-base font-semibold">Social Media Links (Max 5)</Label>
                <div className="space-y-3">
                  {(settings.socialLinks || []).map((link, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={link.platform}
                          onValueChange={(value) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].platform = value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                            saveSettings({ socialLinks: newLinks });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="twitter">X (Twitter)</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].url = e.target.value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          }}
                          onBlur={() => saveSettings({ socialLinks: settings.socialLinks })}
                          placeholder="https://social-media.com/yourprofile"
                          className="flex-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1"
                        onClick={() => {
                          const newLinks = (settings.socialLinks || []).filter((_, i) => i !== index);
                          setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          saveSettings({ socialLinks: newLinks });
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {(settings.socialLinks || []).length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => {
                        const newLinks = [...(settings.socialLinks || []), { platform: 'facebook', url: '' }];
                        setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Social Link
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Service Areas Manager Component (inside Company Settings)
function ServiceAreasManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    zipcode: '',
    isActive: true,
  });

  // Fetch all service areas (including inactive for admin)
  const { data: fetchedAreas, isLoading } = useQuery<ServiceArea[]>({
    queryKey: ['/api/service-areas', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-areas?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service areas');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedAreas) {
      setAreas(fetchedAreas);
    }
  }, [fetchedAreas]);

  // Create mutation
  const createArea = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-areas', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service area', description: error.message, variant: 'destructive' });
    }
  });

  // Update mutation
  const updateArea = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-areas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area updated successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service area', description: error.message, variant: 'destructive' });
    }
  });

  // Delete mutation
  const deleteArea = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service area', description: error.message, variant: 'destructive' });
    }
  });

  // Reorder mutation
  const reorderAreas = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-areas/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
    },
  });

  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && areas) {
      const oldIndex = areas.findIndex((a) => a.id === active.id);
      const newIndex = areas.findIndex((a) => a.id === over.id);
      const newAreas = arrayMove(areas, oldIndex, newIndex);
      setAreas(newAreas);
      const updates = newAreas.map((area, index) => ({ id: area.id, order: index }));
      reorderAreas.mutate(updates);
    }
  };

  // Form handlers
  const resetForm = () => {
    setFormData({ name: '', region: '', zipcode: '', isActive: true });
    setEditingArea(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingArea) {
      updateArea.mutate({ id: editingArea.id, data: formData });
    } else {
      createArea.mutate({ ...formData, order: areas.length });
    }
  };

  const handleEdit = (area: ServiceArea) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      region: area.region,
      zipcode: area.zipcode || '',
      isActive: area.isActive,
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Spinner /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingArea ? 'Edit Service Area' : 'Add Service Area'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="region">Region/County *</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g., Middlesex County, Norfolk County, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">City/Town Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Boston, Cambridge"
                  required
                />
              </div>
              <div>
                <Label htmlFor="zipcode">Zipcode (Optional)</Label>
                <Input
                  id="zipcode"
                  value={formData.zipcode}
                  onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                  placeholder="e.g., 02138"
                  maxLength={5}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">
                  {editingArea ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {areas.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service areas yet. Add your first area to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={areas.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {areas.map((area) => (
                <SortableServiceAreaItem
                  key={area.id}
                  area={area}
                  onEdit={handleEdit}
                  onDelete={deleteArea.mutate}
                  onToggleActive={(id, isActive) =>
                    updateArea.mutate({ id, data: { name: area.name, region: area.region, zipcode: area.zipcode || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Sortable item component for Service Areas
function SortableServiceAreaItem({
  area,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  area: ServiceArea;
  onEdit: (area: ServiceArea) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: area.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{area.name}</span>
            <Badge variant={area.isActive ? 'default' : 'secondary'} className="text-xs">
              {area.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{area.region}</span>
            {area.zipcode && (
              <>
                <span>•</span>
                <span>Zip: {area.zipcode}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onToggleActive(area.id, !area.isActive)}
        >
          {area.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(area)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (window.confirm('Delete this service area?')) {
              onDelete(area.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// ===== NEW HIERARCHICAL SERVICE AREAS MANAGERS =====

// Unified Service Areas Manager (Groups + Cities in one interface)
function UnifiedServiceAreasManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<ServiceAreaGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceAreaGroup | null>(null);
  const [editingCity, setEditingCity] = useState<ServiceAreaCity | null>(null);
  const [selectedGroupForCity, setSelectedGroupForCity] = useState<number | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
  });
  const [cityFormData, setCityFormData] = useState({
    areaGroupId: 0,
    name: '',
    zipcode: '',
    isActive: true,
  });

  const { data: fetchedGroups, isLoading: groupsLoading } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service area groups');
      return response.json();
    },
  });

  const { data: cities, isLoading: citiesLoading } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedGroups) {
      setGroups(fetchedGroups);
    }
  }, [fetchedGroups]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  // Group mutations
  const createGroup = useMutation({
    mutationFn: async (data: typeof groupFormData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-groups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region created successfully' });
      resetGroupForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create region', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof groupFormData }) => {
      return apiRequest('PUT', `/api/service-area-groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region updated successfully' });
      resetGroupForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update region', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete region', description: error.message, variant: 'destructive' });
    }
  });

  // City mutations
  const createCity = useMutation({
    mutationFn: async (data: typeof cityFormData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-cities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City created successfully' });
      resetCityForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create city', description: error.message, variant: 'destructive' });
    }
  });

  const updateCity = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof cityFormData }) => {
      return apiRequest('PUT', `/api/service-area-cities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City updated successfully' });
      resetCityForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update city', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCity = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-cities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete city', description: error.message, variant: 'destructive' });
    }
  });

  const resetGroupForm = () => {
    setGroupFormData({ name: '', slug: '', description: '', isActive: true });
    setEditingGroup(null);
    setIsGroupDialogOpen(false);
  };

  const resetCityForm = () => {
    setCityFormData({ areaGroupId: 0, name: '', zipcode: '', isActive: true });
    setEditingCity(null);
    setIsCityDialogOpen(false);
    setSelectedGroupForCity(null);
  };

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithSlug = { ...groupFormData, slug: generateSlug(groupFormData.name) };
    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, data: dataWithSlug });
    } else {
      createGroup.mutate({ ...dataWithSlug, order: groups.length });
    }
  };

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const groupCities = cities?.filter(c => c.areaGroupId === cityFormData.areaGroupId) || [];
    if (editingCity) {
      updateCity.mutate({ id: editingCity.id, data: cityFormData });
    } else {
      createCity.mutate({ ...cityFormData, order: groupCities.length });
    }
  };

  const handleEditGroup = (group: ServiceAreaGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      isActive: group.isActive,
    });
    setIsGroupDialogOpen(true);
  };

  const handleEditCity = (city: ServiceAreaCity) => {
    setEditingCity(city);
    setCityFormData({
      areaGroupId: city.areaGroupId,
      name: city.name,
      zipcode: city.zipcode || '',
      isActive: city.isActive,
    });
    setIsCityDialogOpen(true);
  };

  const handleAddCityToGroup = (groupId: number) => {
    setSelectedGroupForCity(groupId);
    setCityFormData({ ...cityFormData, areaGroupId: groupId });
    setIsCityDialogOpen(true);
  };

  const toggleGroupExpansion = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getCitiesForGroup = (groupId: number) => {
    return cities?.filter(c => c.areaGroupId === groupId) || [];
  };

  if (groupsLoading || citiesLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Group Button */}
      <div className="flex justify-end">
        <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetGroupForm(); setIsGroupDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Service Area Group' : 'Add Service Area Group'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <Label htmlFor="group-name">Region/County Name *</Label>
                <Input
                  id="group-name"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="e.g., MetroWest, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="group-description">Description (Optional)</Label>
                <Textarea
                  id="group-description"
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  placeholder="Brief description of this service area"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="group-isActive"
                  checked={groupFormData.isActive}
                  onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
                />
                <Label htmlFor="group-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetGroupForm}>Cancel</Button>
                <Button type="submit">
                  {editingGroup ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* City Dialog */}
      <Dialog open={isCityDialogOpen} onOpenChange={setIsCityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCitySubmit} className="space-y-4">
            <div>
              <Label htmlFor="city-group">Service Area Group *</Label>
              <Select
                value={cityFormData.areaGroupId ? String(cityFormData.areaGroupId) : ''}
                onValueChange={(value) => setCityFormData({ ...cityFormData, areaGroupId: Number(value) })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map(group => (
                    <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city-name">City/Town Name *</Label>
              <Input
                id="city-name"
                value={cityFormData.name}
                onChange={(e) => setCityFormData({ ...cityFormData, name: e.target.value })}
                placeholder="e.g., Framingham, Natick"
                required
              />
            </div>
            <div>
              <Label htmlFor="city-zipcode">Zipcode (Optional)</Label>
              <Input
                id="city-zipcode"
                value={cityFormData.zipcode}
                onChange={(e) => setCityFormData({ ...cityFormData, zipcode: e.target.value })}
                placeholder="e.g., 02138"
                maxLength={5}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="city-isActive"
                checked={cityFormData.isActive}
                onCheckedChange={(checked) => setCityFormData({ ...cityFormData, isActive: checked })}
              />
              <Label htmlFor="city-isActive">Active (visible on website)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCityForm}>Cancel</Button>
              <Button type="submit" disabled={!cityFormData.areaGroupId}>
                {editingCity ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service area groups yet. Add your first region to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupCities = getCitiesForGroup(group.id);
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id} className="border rounded-lg bg-slate-50">
                {/* Group Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleGroupExpansion(group.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    <MapPin className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{group.name}</span>
                        <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
                          {group.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {groupCities.length} {groupCities.length === 1 ? 'city' : 'cities'}
                        </Badge>
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => updateGroup.mutate({ id: group.id, data: { ...groupFormData, name: group.name, slug: group.slug, description: group.description || '', isActive: !group.isActive } })}
                    >
                      {group.isActive ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditGroup(group)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (groupCities.length > 0) {
                          toast({ title: `Cannot delete region with ${groupCities.length} cities`, description: 'Delete or reassign cities first', variant: 'destructive' });
                        } else if (window.confirm(`Delete region "${group.name}"?`)) {
                          deleteGroup.mutate(group.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Cities List (Expanded) */}
                {isExpanded && (
                  <div className="border-t bg-white p-4 space-y-2">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-slate-600">Cities in {group.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddCityToGroup(group.id)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add City
                      </Button>
                    </div>

                    {groupCities.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No cities yet. Click "Add City" to get started.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {groupCities.map((city) => (
                          <div key={city.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm font-medium">{city.name}</span>
                              {city.zipcode && (
                                <span className="text-xs text-slate-500">• Zip: {city.zipcode}</span>
                              )}
                              <Badge variant={city.isActive ? 'default' : 'secondary'} className="text-xs h-5">
                                {city.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => updateCity.mutate({ id: city.id, data: { ...cityFormData, areaGroupId: city.areaGroupId, name: city.name, zipcode: city.zipcode || '', isActive: !city.isActive } })}
                              >
                                {city.isActive ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditCity(city)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  if (window.confirm(`Delete city "${city.name}"?`)) {
                                    deleteCity.mutate(city.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Keep old components for reference/backward compatibility (can be removed later)
function ServiceAreaGroupsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<ServiceAreaGroup[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceAreaGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
  });

  const { data: fetchedGroups, isLoading } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service area groups');
      return response.json();
    },
  });

  const { data: cities } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedGroups) {
      setGroups(fetchedGroups);
    }
  }, [fetchedGroups]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const createGroup = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-groups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service area group', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-area-groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group updated successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service area group', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service area group', description: error.message, variant: 'destructive' });
    }
  });

  const reorderGroups = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-area-groups/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && groups) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);
      const updates = newGroups.map((group, index) => ({ id: group.id, order: index }));
      reorderGroups.mutate(updates);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', isActive: true });
    setEditingGroup(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithSlug = { ...formData, slug: generateSlug(formData.name) };
    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, data: dataWithSlug });
    } else {
      createGroup.mutate({ ...dataWithSlug, order: groups.length });
    }
  };

  const handleEdit = (group: ServiceAreaGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      isActive: group.isActive,
    });
    setIsDialogOpen(true);
  };

  const getCityCount = (groupId: number) => {
    return cities?.filter(c => c.areaGroupId === groupId).length || 0;
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Service Area Group' : 'Add Service Area Group'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="group-name">Region/County Name *</Label>
                <Input
                  id="group-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., MetroWest, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="group-description">Description (Optional)</Label>
                <Textarea
                  id="group-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this service area"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="group-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="group-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">
                  {editingGroup ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service area groups yet. Add your first region to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {groups.map((group) => (
                <SortableServiceAreaGroupItem
                  key={group.id}
                  group={group}
                  cityCount={getCityCount(group.id)}
                  onEdit={handleEdit}
                  onDelete={deleteGroup.mutate}
                  onToggleActive={(id, isActive) =>
                    updateGroup.mutate({ id, data: { ...formData, name: group.name, slug: group.slug, description: group.description || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableServiceAreaGroupItem({
  group,
  cityCount,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  group: ServiceAreaGroup;
  cityCount: number;
  onEdit: (group: ServiceAreaGroup) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{group.name}</span>
            <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
              {group.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {cityCount} {cityCount === 1 ? 'city' : 'cities'}
            </Badge>
          </div>
          {group.description && (
            <p className="text-xs text-slate-500 mt-1">{group.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onToggleActive(group.id, !group.isActive)}
        >
          {group.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(group)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (cityCount > 0) {
              toast({ title: `Cannot delete group with ${cityCount} cities`, description: 'Delete or reassign cities first', variant: 'destructive' });
            } else if (window.confirm('Delete this service area group?')) {
              onDelete(group.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// Service Area Cities Manager Component
function ServiceAreaCitiesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cities, setCities] = useState<ServiceAreaCity[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<ServiceAreaCity | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<string>('all');
  const [formData, setFormData] = useState({
    areaGroupId: 0,
    name: '',
    zipcode: '',
    isActive: true,
  });

  const { data: groups } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const { data: fetchedCities, isLoading } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedCities) {
      setCities(fetchedCities);
    }
  }, [fetchedCities]);

  const createCity = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-cities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create city', description: error.message, variant: 'destructive' });
    }
  });

  const updateCity = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-area-cities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City updated successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update city', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCity = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-cities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete city', description: error.message, variant: 'destructive' });
    }
  });

  const reorderCities = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-area-cities/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && cities) {
      const oldIndex = cities.findIndex((c) => c.id === active.id);
      const newIndex = cities.findIndex((c) => c.id === over.id);
      const newCities = arrayMove(cities, oldIndex, newIndex);
      setCities(newCities);
      const updates = newCities.map((city, index) => ({ id: city.id, order: index }));
      reorderCities.mutate(updates);
    }
  };

  const resetForm = () => {
    setFormData({ areaGroupId: 0, name: '', zipcode: '', isActive: true });
    setEditingCity(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCity) {
      updateCity.mutate({ id: editingCity.id, data: formData });
    } else {
      createCity.mutate({ ...formData, order: cities.length });
    }
  };

  const handleEdit = (city: ServiceAreaCity) => {
    setEditingCity(city);
    setFormData({
      areaGroupId: city.areaGroupId,
      name: city.name,
      zipcode: city.zipcode || '',
      isActive: city.isActive,
    });
    setIsDialogOpen(true);
  };

  const getGroupName = (groupId: number) => {
    return groups?.find(g => g.id === groupId)?.name || 'Unknown';
  };

  const filteredCities = cities?.filter(city => {
    return filterGroupId === 'all' || city.areaGroupId === Number(filterGroupId);
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Select value={filterGroupId} onValueChange={setFilterGroupId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {groups?.map(group => (
              <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add City
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="city-group">Service Area Group *</Label>
                <Select
                  value={formData.areaGroupId ? String(formData.areaGroupId) : ''}
                  onValueChange={(value) => setFormData({ ...formData, areaGroupId: Number(value) })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups?.map(group => (
                      <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="city-name">City/Town Name *</Label>
                <Input
                  id="city-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Framingham, Natick"
                  required
                />
              </div>
              <div>
                <Label htmlFor="city-zipcode">Zipcode (Optional)</Label>
                <Input
                  id="city-zipcode"
                  value={formData.zipcode}
                  onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                  placeholder="e.g., 02138"
                  maxLength={5}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="city-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="city-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={!formData.areaGroupId}>
                  {editingCity ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredCities.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No cities yet. Add your first city to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredCities.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredCities.map((city) => (
                <SortableServiceAreaCityItem
                  key={city.id}
                  city={city}
                  groupName={getGroupName(city.areaGroupId)}
                  onEdit={handleEdit}
                  onDelete={deleteCity.mutate}
                  onToggleActive={(id, isActive) =>
                    updateCity.mutate({ id, data: { ...formData, areaGroupId: city.areaGroupId, name: city.name, zipcode: city.zipcode || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableServiceAreaCityItem({
  city,
  groupName,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  city: ServiceAreaCity;
  groupName: string;
  onEdit: (city: ServiceAreaCity) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: city.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{city.name}</span>
            <Badge variant={city.isActive ? 'default' : 'secondary'} className="text-xs">
              {city.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="text-xs border-0 bg-secondary">
              {groupName}
            </Badge>
            {city.zipcode && (
              <>
                <span>•</span>
                <span>Zip: {city.zipcode}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onToggleActive(city.id, !city.isActive)}
        >
          {city.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(city)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (window.confirm('Delete this city?')) {
              onDelete(city.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

function SEOSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SEOSettingsData>({
    seoTitle: '',
    seoDescription: '',
    ogImage: '',
    seoKeywords: '',
    seoAuthor: '',
    seoCanonicalUrl: '',
    seoRobotsTag: 'index, follow',
    ogType: 'website',
    ogSiteName: '',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    twitterCreator: '',
    schemaLocalBusiness: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<SEOSettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(prev => ({
        ...prev,
        seoTitle: fetchedSettings.seoTitle || '',
        seoDescription: fetchedSettings.seoDescription || '',
        ogImage: fetchedSettings.ogImage || '',
        seoKeywords: fetchedSettings.seoKeywords || '',
        seoAuthor: fetchedSettings.seoAuthor || '',
        seoCanonicalUrl: fetchedSettings.seoCanonicalUrl || '',
        seoRobotsTag: fetchedSettings.seoRobotsTag || 'index, follow',
        ogType: fetchedSettings.ogType || 'website',
        ogSiteName: fetchedSettings.ogSiteName || '',
        twitterCard: fetchedSettings.twitterCard || 'summary_large_image',
        twitterSite: fetchedSettings.twitterSite || '',
        twitterCreator: fetchedSettings.twitterCreator || '',
        schemaLocalBusiness: fetchedSettings.schemaLocalBusiness || null,
      }));
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<SEOSettingsData>) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const updateField = useCallback(<K extends keyof SEOSettingsData>(field: K, value: SEOSettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">SEO Settings</h1>
          <p className="text-muted-foreground">Optimize your site for search engines and social media</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Auto-saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Basic SEO
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Page Title</Label>
                <Input
                  id="seoTitle"
                  value={settings.seoTitle || ''}
                  onChange={(e) => updateField('seoTitle', e.target.value)}
                  placeholder="Your Business - Main Service"
                  data-testid="input-seo-title"
                />
                <p className="text-xs text-muted-foreground">
                  Appears in browser tab and search results (50-60 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoDescription">Meta Description</Label>
                <Textarea
                  id="seoDescription"
                  value={settings.seoDescription || ''}
                  onChange={(e) => updateField('seoDescription', e.target.value)}
                  placeholder="Brief description of your business and services..."
                  rows={3}
                  data-testid="input-seo-description"
                />
                <p className="text-xs text-muted-foreground">
                  Shown in search results (150-160 characters recommended)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input
                  id="seoKeywords"
                  value={settings.seoKeywords || ''}
                  onChange={(e) => updateField('seoKeywords', e.target.value)}
                  placeholder="cleaning services, house cleaning, professional cleaners"
                  data-testid="input-seo-keywords"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated keywords relevant to your business
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoAuthor">Author / Publisher</Label>
                <Input
                  id="seoAuthor"
                  value={settings.seoAuthor || ''}
                  onChange={(e) => updateField('seoAuthor', e.target.value)}
                  placeholder="Your Company Name"
                  data-testid="input-seo-author"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoCanonicalUrl">Canonical URL</Label>
                <Input
                  id="seoCanonicalUrl"
                  value={settings.seoCanonicalUrl || ''}
                  onChange={(e) => updateField('seoCanonicalUrl', e.target.value)}
                  placeholder="https://yourdomain.com"
                  data-testid="input-seo-canonical"
                />
                <p className="text-xs text-muted-foreground">
                  Your main website URL (prevents duplicate content issues)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seoRobotsTag">Robots Tag</Label>
                <Select
                  value={settings.seoRobotsTag || 'index, follow'}
                  onValueChange={(value) => updateField('seoRobotsTag', value)}
                >
                  <SelectTrigger data-testid="select-robots-tag">
                    <SelectValue placeholder="Select robots directive" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="index, follow">Index, Follow (recommended)</SelectItem>
                    <SelectItem value="index, nofollow">Index, No Follow</SelectItem>
                    <SelectItem value="noindex, follow">No Index, Follow</SelectItem>
                    <SelectItem value="noindex, nofollow">No Index, No Follow</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Controls how search engines crawl and index your site
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Open Graph (Social Sharing)
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="ogSiteName">Site Name</Label>
                <Input
                  id="ogSiteName"
                  value={settings.ogSiteName || ''}
                  onChange={(e) => updateField('ogSiteName', e.target.value)}
                  placeholder="Your Business Name"
                  data-testid="input-og-site-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ogType">Content Type</Label>
                <Select
                  value={settings.ogType || 'website'}
                  onValueChange={(value) => updateField('ogType', value)}
                >
                  <SelectTrigger data-testid="select-og-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="business.business">Business</SelectItem>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>OG Image</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Image shown when shared on Facebook, LinkedIn, etc. (1200x630px recommended)
                </p>
                <div className="flex flex-col gap-3">
                  <div className="aspect-[1.91/1] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                    {settings.ogImage ? (
                      <img src={settings.ogImage} alt="OG Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">1200 x 630 px</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const token = await getAccessToken();
                            if (!token) {
                              toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
                              return;
                            }
                            const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
                            const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
                            await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                            setSettings(prev => ({ ...prev, ogImage: objectPath }));
                            await saveSettings({ ogImage: objectPath });
                            toast({ title: 'Open Graph image uploaded' });
                          } catch (error: any) {
                            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                          }
                        }}
                        accept="image/*"
                      />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                  {settings.ogImage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => {
                        setSettings(prev => ({ ...prev, ogImage: '' }));
                        saveSettings({ ogImage: '' });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Remove Image
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Twitter Cards
            </h2>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="twitterCard">Card Type</Label>
                <Select
                  value={settings.twitterCard || 'summary_large_image'}
                  onValueChange={(value) => updateField('twitterCard', value)}
                >
                  <SelectTrigger data-testid="select-twitter-card">
                    <SelectValue placeholder="Select card type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="summary_large_image">Summary with Large Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterSite">Twitter @username (Site)</Label>
                <Input
                  id="twitterSite"
                  value={settings.twitterSite || ''}
                  onChange={(e) => updateField('twitterSite', e.target.value)}
                  placeholder="@yourbusiness"
                  data-testid="input-twitter-site"
                />
                <p className="text-xs text-muted-foreground">
                  Your business Twitter handle
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterCreator">Twitter @username (Creator)</Label>
                <Input
                  id="twitterCreator"
                  value={settings.twitterCreator || ''}
                  onChange={(e) => updateField('twitterCreator', e.target.value)}
                  placeholder="@yourhandle"
                  data-testid="input-twitter-creator"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoriesSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [selectedCategoryForSubs, setSelectedCategoryForSubs] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState('');
  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  useEffect(() => {
    if (categories) {
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA === orderB) return a.id - b.id;
        return orderA - orderB;
      });
      setOrderedCategories(sorted);
    }
  }, [categories]);

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string; imageUrl: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('POST', '/api/categories', token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    }
  });

  const updateCategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; description: string; imageUrl: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/categories/${data.id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category updated successfully' });
      setEditingCategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update category', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/categories/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete category', description: error.message, variant: 'destructive' });
    }
  });

  const getServiceCount = (categoryId: number) => {
    return services?.filter(s => s.categoryId === categoryId).length || 0;
  };

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('POST', '/api/subcategories', token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/subcategories/${data.id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenSubDialog = (category: Category) => {
    setSelectedCategoryForSubs(category);
    setEditingSubcategory(null);
    setSubName('');
    setIsSubDialogOpen(true);
  };

  const handleSaveSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForSubs) return;
    const payload = {
      name: subName,
      slug: subName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      categoryId: selectedCategoryForSubs.id,
    };
    if (editingSubcategory) {
      updateSubcategory.mutate({ ...payload, id: editingSubcategory.id });
    } else {
      createSubcategory.mutate(payload);
    }
  };

  const categorySubcategories = selectedCategoryForSubs
    ? subcategories?.filter(sub => sub.categoryId === selectedCategoryForSubs.id)
    : [];

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedCategories(prev => {
      const oldIndex = prev.findIndex(c => c.id === Number(active.id));
      const newIndex = prev.findIndex(c => c.id === Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const previous = prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const reorderPayload = reordered.map((cat, index) => ({
        id: cat.id,
        order: index
      }));

      getAccessToken().then(token => {
        if (!token) throw new Error('Authentication required');
        return authenticatedRequest('PUT', '/api/categories/reorder', token, { order: reorderPayload });
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          toast({ title: 'Category order updated' });
        })
        .catch((error: any) => {
          toast({
            title: 'Failed to update order',
            description: error.message,
            variant: 'destructive'
          });
          setOrderedCategories(previous);
        });

      return reordered;
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your service categories. Drag to reorder.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="border-0 bg-white dark:bg-slate-800">
            <CategoryForm
              category={editingCategory}
              getAccessToken={getAccessToken}
              onSubmit={(data) => {
                if (editingCategory) {
                  updateCategory.mutate({ ...data, id: editingCategory.id });
                } else {
                  createCategory.mutate(data);
                }
              }}
              isLoading={createCategory.isPending || updateCategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {orderedCategories?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-4">Create your first category to get started</p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={orderedCategories.map(cat => cat.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {orderedCategories?.map((category, index) => (
                <CategoryReorderRow
                  key={category.id}
                  category={category}
                  serviceCount={getServiceCount(category.id)}
                  onEdit={() => { setEditingCategory(category); setIsDialogOpen(true); }}
                  onDelete={() => deleteCategory.mutate(category.id)}
                  disableDelete={getServiceCount(category.id) > 0}
                  index={index}
                  onManageSubcategories={() => handleOpenSubDialog(category)}
                  subcategories={subcategories}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={isSubDialogOpen} onOpenChange={(open) => {
        setIsSubDialogOpen(open);
        if (!open) {
          setSelectedCategoryForSubs(null);
          setEditingSubcategory(null);
          setSubName('');
        }
      }}>
        <DialogContent className="max-w-xl border-0 bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle>
              Manage subcategories {selectedCategoryForSubs ? `for ${selectedCategoryForSubs.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubcategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory-name-inline">Name</Label>
              <Input
                id="subcategory-name-inline"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                required
                data-testid="input-subcategory-name-inline"
              />
            </div>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-0">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0"
                disabled={
                  !subName ||
                  createSubcategory.isPending ||
                  updateSubcategory.isPending ||
                  !selectedCategoryForSubs
                }
              >
                {(createSubcategory.isPending || updateSubcategory.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingSubcategory ? 'Update subcategory' : 'Add subcategory'}
              </Button>
            </div>
          </form>

          <div className="mt-6 space-y-3 max-h-80 overflow-y-auto pr-1">
            {categorySubcategories && categorySubcategories.length > 0 ? (
              categorySubcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-slate-700"
                  data-testid={`subcategory-item-${subcategory.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{subcategory.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {services?.filter(s => s.subcategoryId === subcategory.id).length || 0} services
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingSubcategory(subcategory);
                        setSubName(subcategory.name);
                      }}
                      data-testid={`button-edit-subcategory-${subcategory.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Subcategory?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0
                              ? 'This subcategory has services. Delete or reassign them first.'
                              : 'This action cannot be undone.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSubcategory.mutate(subcategory.id)}
                            disabled={(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0}
                            variant="destructive"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No subcategories yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryForm({ category, onSubmit, isLoading, getAccessToken }: {
  category: Category | null;
  onSubmit: (data: { name: string; slug: string; description: string; imageUrl: string }) => void;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('Authentication required');
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      const uploadFetchRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadFetchRes.ok) throw new Error('Upload to storage failed');

      setImageUrl(objectPath);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), description, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-category-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-category-description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Category Image</Label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or URL:</span>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
                data-testid="input-category-image"
              />
            </div>
            {imageUrl && (
              <div className="relative w-48 aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border cursor-pointer group" onClick={() => document.getElementById('categoryImageUpload')?.click()}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-white text-xs font-medium">Click to upload</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </div>
            )}
            <Input
              id="categoryImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              data-testid="input-category-image-upload"
              className="hidden"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button" className="border-0">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category" className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {category ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubcategoriesSection() {
  const { toast } = useToast();
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories, isLoading } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      return apiRequest('POST', '/api/subcategories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      return apiRequest('PUT', `/api/subcategories/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getServiceCount = (subcategoryId: number) => {
    return services?.filter(s => s.subcategoryId === subcategoryId).length || 0;
  };

  const filteredSubcategories = subcategories?.filter(sub => {
    return filterCategory === 'all' || sub.categoryId === Number(filterCategory);
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subcategories</h1>
          <p className="text-muted-foreground">Organize services within categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSubcategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-subcategory">
              <Plus className="w-4 h-4 mr-2" />
              Add Subcategory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubcategoryForm
              subcategory={editingSubcategory}
              categories={categories || []}
              onSubmit={(data) => {
                if (editingSubcategory) {
                  updateSubcategory.mutate({ ...data, id: editingSubcategory.id });
                } else {
                  createSubcategory.mutate(data);
                }
              }}
              isLoading={createSubcategory.isPending || updateSubcategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-subcategory-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredSubcategories?.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-lg">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No subcategories yet</h3>
          <p className="text-muted-foreground mb-4">Create subcategories to organize your services</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSubcategories?.map((subcategory) => (
            <div
              key={subcategory.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted transition-all"
              data-testid={`subcategory-item-${subcategory.id}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{subcategory.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="border-0 bg-secondary">
                    {getCategoryName(subcategory.categoryId)}
                  </Badge>
                  <Badge variant="outline" className="border-0 bg-secondary">
                    {getServiceCount(subcategory.id)} services
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditingSubcategory(subcategory); setIsDialogOpen(true); }}
                  data-testid={`button-edit-subcategory-${subcategory.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Subcategory?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {getServiceCount(subcategory.id) > 0
                          ? `This subcategory has ${getServiceCount(subcategory.id)} services. You must delete or reassign them first.`
                          : 'This action cannot be undone.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteSubcategory.mutate(subcategory.id)}
                        disabled={getServiceCount(subcategory.id) > 0}
                        variant="destructive"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubcategoryForm({ subcategory, categories, onSubmit, isLoading }: {
  subcategory: Subcategory | null;
  categories: Category[];
  onSubmit: (data: { name: string; slug: string; categoryId: number }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(subcategory?.name || '');
  const [categoryId, setCategoryId] = useState(subcategory?.categoryId?.toString() || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), categoryId: Number(categoryId) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="subcategory-name">Name</Label>
          <Input id="subcategory-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-subcategory-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategory-category">Parent Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} required>
            <SelectTrigger data-testid="select-subcategory-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-subcategory">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {subcategory ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ServicesSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderedServices, setOrderedServices] = useState<Service[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const scrollPositionRef = useRef<number>(0);

  // Restore scroll position when dialog closes
  useEffect(() => {
    if (!isDialogOpen && scrollPositionRef.current > 0) {
      const container = document.getElementById('admin-top');
      if (container) {
        // Force restore scroll position multiple times to fight layout shifts
        const restore = () => {
          if (scrollPositionRef.current > 0 && Math.abs(container.scrollTop - scrollPositionRef.current) > 5) {
            container.scrollTop = scrollPositionRef.current;
          }
        };

        // Immediate attempt
        restore();

        // Aggressive staggered attempts to handle React Query invalidation and re-renders
        const timers = [
          setTimeout(restore, 10),
          setTimeout(restore, 50),
          setTimeout(restore, 100),
          setTimeout(restore, 200),
          setTimeout(restore, 300),
          setTimeout(restore, 500),
          setTimeout(restore, 800)
        ];

        return () => timers.forEach(clearTimeout);
      }
    }
  }, [isDialogOpen]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/services', { includeHidden: true }],
    queryFn: () => fetch('/api/services?includeHidden=true').then(r => r.json())
  });

  const { data: addonRelationships } = useQuery<{ id: number, serviceId: number, addonServiceId: number }[]>({
    queryKey: ['/api/service-addons'],
    queryFn: () => fetch('/api/service-addons').then(r => r.json())
  });

  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createService = useMutation({
    mutationFn: async (data: Omit<Service, 'id'> & { addonIds?: number[], options?: any[], frequencies?: any[] }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const { addonIds, options, frequencies, ...serviceData } = data;
      const response = await authenticatedRequest('POST', '/api/services', token, serviceData);
      const newService = await response.json() as Service;
      if (newService?.id) {
        // Save addons
        if (addonIds && addonIds.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/addons`, token, { addonIds });
        }
        // Save options for base_plus_addons
        if (options && options.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/options`, token, { options });
        }
        // Save frequencies for base_plus_addons
        if (frequencies && frequencies.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/frequencies`, token, { frequencies });
        }
      }
      return newService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
    }
  });

  const updateService = useMutation({
    mutationFn: async (data: Service & { addonIds?: number[], options?: any[], frequencies?: any[] }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const { addonIds, options, frequencies, ...serviceData } = data;
      const response = await authenticatedRequest('PUT', `/api/services/${data.id}`, token, serviceData);
      const updatedService = await response.json();
      // Update addons
      if (addonIds !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/addons`, token, { addonIds });
      }
      // Update options for base_plus_addons
      if (options !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/options`, token, { options });
      }
      // Update frequencies for base_plus_addons
      if (frequencies !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/frequencies`, token, { frequencies });
      }
      return updatedService;
    },
    onSuccess: async (updatedService) => {
      // Update local state immediately for instant UI feedback
      setOrderedServices(prev =>
        prev.map(s => s.id === updatedService.id ? updatedService : s)
      );
      // Also update the query cache directly
      queryClient.setQueryData(['/api/services', { includeHidden: true }], (old: Service[] | undefined) =>
        old?.map(s => s.id === updatedService.id ? updatedService : s) ?? []
      );
      // Refetch to ensure consistency
      await queryClient.refetchQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      await queryClient.refetchQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service updated successfully' });
      const savedScrollPosition = scrollPositionRef.current;
      setEditingService(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
    }
  });

  const deleteService = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/services/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service', description: error.message, variant: 'destructive' });
    }
  });

  const toggleShowOnLanding = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('PUT', `/api/services/${id}/toggle-landing`, token);
      return res.json();
    },
    onSuccess: (updatedService) => {
      // Update local state immediately for instant UI feedback
      setOrderedServices(prev =>
        prev.map(s => s.id === updatedService.id ? updatedService : s)
      );
      // Also update the query cache directly
      queryClient.setQueryData(['/api/services', { includeHidden: true }], (old: Service[] | undefined) =>
        old?.map(s => s.id === updatedService.id ? updatedService : s) ?? []
      );
      const isVisible = updatedService.showOnLanding;
      toast({
        title: isVisible ? 'Service visible on landing page' : 'Service hidden from landing page',
        description: isVisible ? 'Customers will see this service on the homepage' : 'This service is now hidden from the homepage'
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle visibility', description: error.message, variant: 'destructive' });
    }
  });

  const reorderServices = useMutation<Service[], Error, { id: number; order: number }[]>({
    mutationFn: async (orderData: { id: number; order: number }[]) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('PUT', '/api/services/reorder', token, { order: orderData });
      return res.json();
    },
    onError: (error: Error) => {
      // Refetch to restore correct order on error
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({ title: 'Failed to reorder services', description: error.message, variant: 'destructive' });
    },
    onSuccess: (data) => {
      const sorted = [...(data || [])].sort((a, b) => {
        const oa = a.order ?? 0;
        const ob = b.order ?? 0;
        return oa !== ob ? oa - ob : a.id - b.id;
      });
      // Update local state and cache directly without refetching
      setOrderedServices(sorted);
      queryClient.setQueryData(['/api/services', { includeHidden: true }], sorted);
      queryClient.setQueryData(['/api/services'], sorted.filter(s => !s.isHidden));
      toast({ title: 'Service order updated' });
    }
  });

  const filteredServices = useMemo(() => {
    const base = orderedServices.length > 0 ? orderedServices : services || [];
    const filtered = base.filter(service => {
      const matchesCategory = filterCategory === 'all' || service.categoryId === Number(filterCategory);
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
    return filtered.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
  }, [services, filterCategory, searchQuery, orderedServices]);

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const orderedServicesRef = useRef(orderedServices);
  orderedServicesRef.current = orderedServices;

  useEffect(() => {
    // Only sync from server on initial load or when services list changes (add/delete)
    // Skip during reorder operations to avoid flicker
    if (!services || reorderServices.isPending) return;

    const current = orderedServicesRef.current;

    // Check if this is just a reorder (same IDs, different order) - skip sync
    if (current.length > 0) {
      const currentIds = current.map(s => s.id);
      const newIds = new Set(services.map(s => s.id));
      const sameServices = currentIds.length === newIds.size &&
        currentIds.every(id => newIds.has(id));
      if (sameServices) return;
    }

    const sorted = [...services].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
    setOrderedServices(sorted);
  }, [services, reorderServices.isPending]);

  const handleServiceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedServices.findIndex(item => item.id === Number(active.id));
    const newIndex = orderedServices.findIndex(item => item.id === Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedServices, oldIndex, newIndex);
    const withOrder = reordered.map((svc, index) => ({ ...svc, order: index }));

    // Optimistically update local state for immediate visual feedback
    setOrderedServices(withOrder);

    // Send only the id and order to the server
    const orderData = withOrder.map(svc => ({ id: svc.id, order: svc.order as number }));
    reorderServices.mutate(orderData);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground">Manage your cleaning services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-10 px-3 text-sm bg-primary text-primary-foreground border-0 shadow-none focus-visible:ring-0"
              data-testid="button-add-service"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
            <ServiceForm
              service={editingService}
              categories={categories || []}
              subcategories={subcategories || []}
              allServices={services || []}
              addonRelationships={addonRelationships || []}
              getAccessToken={getAccessToken}
              onSubmit={(data) => {
                if (editingService) {
                  updateService.mutate({ ...data, id: editingService.id } as Service);
                } else {
                  createService.mutate(data as Omit<Service, 'id'>);
                }
              }}
              isLoading={createService.isPending || updateService.isPending}
            />
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'grid' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Grid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('list')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'list' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </Button>
        </div>
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-10 bg-card/70 text-sm placeholder:text-muted-foreground border-0 shadow-none focus-visible:ring-0"
          data-testid="input-search-services"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-10 bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0" data-testid="select-filter-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent className="border-0 shadow-none">
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredServices?.length === 0 ? (
        <Card className="p-12 text-center bg-card border border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No services found</h3>
          <p className="text-muted-foreground mb-4">
            {services?.length === 0 ? 'Create your first service to get started' : 'Try adjusting your filters'}
          </p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleServiceDragEnd}
        >
          <SortableContext
            items={filteredServices.map(s => s.id)}
            strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {viewMode === 'grid' ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredServices?.map((service) => (
                  <ServiceGridItem
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => {
                      const container = document.getElementById('admin-top');
                      scrollPositionRef.current = container?.scrollTop || 0;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
                    onDelete={() => deleteService.mutate(service.id)}
                    onToggleLanding={() => toggleShowOnLanding.mutate(service.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredServices?.map((service, index) => (
                  <ServiceListRow
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => {
                      const container = document.getElementById('admin-top');
                      scrollPositionRef.current = container?.scrollTop || 0;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
                    onDelete={() => deleteService.mutate(service.id)}
                    onToggleLanding={() => toggleShowOnLanding.mutate(service.id)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SidebarSortableItem({
  item,
  isActive,
  onSelect,
}: {
  item: typeof menuItems[number];
  isActive: boolean;
  onSelect: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group/menu-item relative transition-all",
        isDragging && "opacity-60 ring-2 ring-primary/30 rounded-md"
      )}
    >
      <SidebarMenuButton
        onClick={() => {
          onSelect();
          if (isMobile) {
            setOpenMobile(false);
          }
        }}
        isActive={isActive}
        data-testid={`nav-${item.id}`}
        className="group/btn"
      >
        <div className="flex items-center gap-2 flex-1">
          <span
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover/btn:opacity-100 transition-opacity"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <item.icon className="w-4 h-4" />
          <span>{item.title}</span>
        </div>
      </SidebarMenuButton>
    </li>
  );
}

function ServiceGridItem({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative overflow-hidden rounded-lg bg-muted transition-all h-full flex flex-col",
        isDragging && "ring-2 ring-primary/40 shadow-lg bg-card/80",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <button
        className="absolute top-2 left-2 z-20 p-2 text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur-sm rounded-md shadow-sm cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Eye toggle button - top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLanding();
        }}
        className={clsx(
          "absolute top-2 right-2 z-20 p-2 rounded-md shadow-sm transition-all",
          service.showOnLanding
            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
            : "bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground"
        )}
        title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}
      >
        {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      {service.imageUrl ? (
        <div
          className="w-full aspect-[4/3] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        <div
          className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          <Package className="w-5 h-5" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg leading-tight pr-6">{service.name}</h3>
          {service.isHidden && (
            <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Add-on Only
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-primary mb-2">${service.price}</div>
        <Badge variant="secondary" className="w-fit border-0 bg-secondary mb-2">
          {categoryName}
        </Badge>
        <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Clock className="w-4 h-4" />
          <span>{durationLabel}</span>
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex-1 bg-card dark:bg-slate-700/60 border-0"
              data-testid={`button-edit-service-${service.id}`}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-card dark:bg-slate-700/60 border-0" data-testid={`button-delete-service-${service.id}`}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{service.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceListRow({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
  index,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-card border border-border shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-md cursor-grab active:cursor-grabbing self-center"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div
          className="w-28 sm:w-32 aspect-[4/3] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-1">{service.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] border-0 bg-secondary">#{index + 1}</Badge>
            {service.isHidden && (
              <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Add-on Only
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-primary">${service.price}</span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{durationLabel}</span>
          </div>
          <Badge variant="secondary" className="w-fit border-0 bg-secondary">
            {categoryName}
          </Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleLanding}
            className="bg-card border-0 text-slate-600 hover:text-slate-800"
            title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}
          >
            {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="bg-card border-0"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card border-0" data-testid={`button-delete-service-${service.id}`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{service.name}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function CategoryReorderRow({
  category,
  serviceCount,
  onEdit,
  onDelete,
  disableDelete,
  index,
  onManageSubcategories,
  subcategories,
}: {
  category: Category;
  serviceCount: number;
  onEdit: () => void;
  onDelete: () => void;
  disableDelete: boolean;
  index: number;
  onManageSubcategories: () => void;
  subcategories?: Subcategory[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg bg-light-gray dark:bg-slate-800 cursor-grab active:cursor-grabbing transition-all shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md"
      )}
      data-testid={`category-item-${category.id}`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <button
          className="text-muted-foreground cursor-grab p-2 -ml-2"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder category"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 sm:hidden">
          <h3 className="font-semibold truncate">{category.name}</h3>
          <Badge variant="secondary" className="mt-1 bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
            {serviceCount} services
          </Badge>
          <Badge variant="outline" className="mt-1 border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
            {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-0"
            onClick={onManageSubcategories}
          >
            Manage subcategories
          </Button>
        </div>
        <div className="flex items-center gap-1 sm:hidden ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid={`button-edit-category-${category.id}-mobile`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}-mobile`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                <AlertDialogDescription>
                  {disableDelete
                    ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                    : 'This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={disableDelete}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{category.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
              {serviceCount} services
            </Badge>
            <Badge variant="outline" className="border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
              {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-0"
              onClick={onManageSubcategories}
            >
              Manage subcategories
            </Button>
          </div>
        </div>
        <Badge variant="secondary" className="border-0 bg-slate-800 text-white shrink-0 self-center dark:bg-slate-700 dark:text-slate-200">
          #{index + 1}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 break-words sm:hidden">{category.description}</p>
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          data-testid={`button-edit-category-${category.id}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}`}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                {disableDelete
                  ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={disableDelete}
                variant="destructive"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Types for pricing
type PricingType = 'fixed_item' | 'area_based' | 'base_plus_addons' | 'custom_quote';

interface AreaSizePreset {
  name: string;
  sqft: number | null;
  price: number;
}

interface ServiceOptionInput {
  id?: number;
  name: string;
  price: string;
  maxQuantity?: number;
  order?: number;
}

interface ServiceFrequencyInput {
  id?: number;
  name: string;
  discountPercent: string;
  order?: number;
}

function ServiceForm({ service, categories, subcategories, allServices, addonRelationships, onSubmit, isLoading, getAccessToken }: {
  service: Service | null;
  categories: Category[];
  subcategories: Subcategory[];
  allServices: Service[];
  addonRelationships: { id: number, serviceId: number, addonServiceId: number }[];
  onSubmit: (data: Partial<Service> & { addonIds?: number[], options?: ServiceOptionInput[], frequencies?: ServiceFrequencyInput[] }) => void;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || '');
  const [durationHours, setDurationHours] = useState(service ? Math.floor(service.durationMinutes / 60) : 0);
  const [durationMinutes, setDurationMinutes] = useState(service ? service.durationMinutes % 60 : 0);
  const [categoryId, setCategoryId] = useState(service?.categoryId?.toString() || '');
  const [subcategoryId, setSubcategoryId] = useState(service?.subcategoryId?.toString() || '');
  const [imageUrl, setImageUrl] = useState(service?.imageUrl || '');
  const [isHidden, setIsHidden] = useState(service?.isHidden || false);
  const [addonSearch, setAddonSearch] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<number[]>(() => {
    if (!service || !Array.isArray(addonRelationships)) return [];
    return addonRelationships.filter(r => r.serviceId === service.id).map(r => r.addonServiceId);
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // New pricing fields
  const [pricingType, setPricingType] = useState<PricingType>((service as any)?.pricingType || 'fixed_item');
  const [basePrice, setBasePrice] = useState((service as any)?.basePrice || '');
  const [pricePerUnit, setPricePerUnit] = useState((service as any)?.pricePerUnit || '');
  const [minimumPrice, setMinimumPrice] = useState((service as any)?.minimumPrice || '');
  const [areaSizes, setAreaSizes] = useState<AreaSizePreset[]>(() => {
    const sizes = (service as any)?.areaSizes;
    if (Array.isArray(sizes)) return sizes;
    return [{ name: 'Small Room', sqft: 100, price: 80 }];
  });

  // Options and frequencies for base_plus_addons
  const [serviceOptions, setServiceOptions] = useState<ServiceOptionInput[]>([]);
  const [serviceFrequencies, setServiceFrequencies] = useState<ServiceFrequencyInput[]>([]);

  // Load options and frequencies when editing existing service
  useEffect(() => {
    if (service?.id && pricingType === 'base_plus_addons') {
      // Fetch options
      fetch(`/api/services/${service.id}/options`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceOptions(data.map((o: any) => ({
              id: o.id,
              name: o.name,
              price: o.price,
              maxQuantity: o.maxQuantity,
              order: o.order
            })));
          }
        })
        .catch(console.error);

      // Fetch frequencies
      fetch(`/api/services/${service.id}/frequencies`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceFrequencies(data.map((f: any) => ({
              id: f.id,
              name: f.name,
              discountPercent: f.discountPercent,
              order: f.order
            })));
          }
        })
        .catch(console.error);
    }
  }, [service?.id, pricingType]);

  const filteredSubcategories = subcategories.filter(sub => sub.categoryId === Number(categoryId));
  const availableAddons = allServices.filter(s =>
    s.id !== service?.id &&
    s.name.toLowerCase().includes(addonSearch.toLowerCase())
  );

  const handleAddonToggle = (addonId: number) => {
    setSelectedAddons(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('Authentication required');
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      const uploadFetchRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadFetchRes.ok) throw new Error('Upload to storage failed');

      setImageUrl(objectPath);
      // Use useToast via a locally accessible variable or props if needed
      // Since toast is from useToast() in the main component, ensuring it's available.
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Service> & { addonIds?: number[], options?: ServiceOptionInput[], frequencies?: ServiceFrequencyInput[] } = {
      name,
      description,
      price: String(price),
      durationMinutes: (durationHours * 60) + durationMinutes,
      categoryId: Number(categoryId),
      imageUrl,
      isHidden,
      addonIds: selectedAddons,
      // New pricing fields
      pricingType,
    } as any;

    if (subcategoryId) {
      data.subcategoryId = Number(subcategoryId);
    }

    // Add pricing-specific fields
    if (pricingType === 'area_based') {
      (data as any).areaSizes = areaSizes;
      (data as any).pricePerUnit = pricePerUnit || null;
      (data as any).minimumPrice = minimumPrice || null;
    } else if (pricingType === 'base_plus_addons') {
      (data as any).basePrice = basePrice || null;
      data.options = serviceOptions;
      data.frequencies = serviceFrequencies;
    } else if (pricingType === 'custom_quote') {
      (data as any).minimumPrice = minimumPrice || null;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Service Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-service-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={(val) => { setCategoryId(val); setSubcategoryId(''); }} required>
            <SelectTrigger data-testid="select-service-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredSubcategories.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory (Optional)</Label>
            <Select value={subcategoryId || "none"} onValueChange={(val) => setSubcategoryId(val === "none" ? '' : val)}>
              <SelectTrigger data-testid="select-service-subcategory">
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {filteredSubcategories.map(sub => (
                  <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-service-description" />
        </div>

        {/* Pricing Type Selector */}
        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={pricingType} onValueChange={(val) => setPricingType(val as PricingType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select pricing type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_item">Fixed Price per Item</SelectItem>
              <SelectItem value="area_based">Price by Area (sqft)</SelectItem>
              <SelectItem value="base_plus_addons">Base + Add-ons</SelectItem>
              <SelectItem value="custom_quote">Custom Quote</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {pricingType === 'fixed_item' && 'Each unit has a fixed price (e.g., $150 per sofa)'}
            {pricingType === 'area_based' && 'Price based on area size with preset options (e.g., carpet cleaning)'}
            {pricingType === 'base_plus_addons' && 'Base price + optional add-ons with frequency discounts (e.g., house cleaning)'}
            {pricingType === 'custom_quote' && 'Customer describes needs, team contacts with quote'}
          </p>
        </div>

        {/* FIXED ITEM: Single Price */}
        {pricingType === 'fixed_item' && (
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              data-testid="input-service-price"
            />
          </div>
        )}

        {/* AREA BASED: Area Sizes + Price per Unit */}
        {pricingType === 'area_based' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Area-Based Pricing</h4>

            {/* Area Size Presets */}
            <div className="space-y-2">
              <Label>Size Presets</Label>
              {areaSizes.map((size, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Name (e.g., Small Room)"
                    value={size.name}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].name = e.target.value;
                      setAreaSizes(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Sqft"
                    type="number"
                    value={size.sqft || ''}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].sqft = e.target.value ? Number(e.target.value) : null;
                      setAreaSizes(updated);
                    }}
                    className="w-20"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={size.price}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].price = Number(e.target.value);
                      setAreaSizes(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAreaSizes(areaSizes.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAreaSizes([...areaSizes, { name: '', sqft: null, price: 0 }])}
              >
                + Add Size Option
              </Button>
            </div>

            {/* Price per Unit for custom input */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price per Sqft (for custom size)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  placeholder="0.75"
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={minimumPrice}
                  onChange={(e) => setMinimumPrice(e.target.value)}
                  placeholder="50.00"
                />
              </div>
            </div>

            {/* Hidden price field for database - use first preset price or minimum */}
            <input type="hidden" value={areaSizes[0]?.price || minimumPrice || '0'} />
          </div>
        )}

        {/* BASE + ADDONS: Base Price + Options + Frequencies */}
        {pricingType === 'base_plus_addons' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Base + Add-ons Pricing</h4>

            <div className="space-y-2">
              <Label>Base Price (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => {
                  setBasePrice(e.target.value);
                  setPrice(e.target.value); // Also set main price
                }}
                placeholder="120.00"
                required
              />
            </div>

            {/* Service Options */}
            <div className="space-y-2">
              <Label>Add-on Options</Label>
              <p className="text-xs text-muted-foreground">Additional services customer can add (e.g., Extra Bedroom +$20)</p>
              {serviceOptions.map((opt, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Option name"
                    value={opt.name}
                    onChange={(e) => {
                      const updated = [...serviceOptions];
                      updated[index].name = e.target.value;
                      setServiceOptions(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={opt.price}
                    onChange={(e) => {
                      const updated = [...serviceOptions];
                      updated[index].price = e.target.value;
                      setServiceOptions(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setServiceOptions(serviceOptions.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceOptions([...serviceOptions, { name: '', price: '' }])}
              >
                + Add Option
              </Button>
            </div>

            {/* Service Frequencies */}
            <div className="space-y-2">
              <Label>Frequency Options</Label>
              <p className="text-xs text-muted-foreground">Recurring service discounts (e.g., Weekly -15%)</p>
              {serviceFrequencies.map((freq, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Frequency name"
                    value={freq.name}
                    onChange={(e) => {
                      const updated = [...serviceFrequencies];
                      updated[index].name = e.target.value;
                      setServiceFrequencies(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Discount %"
                    type="number"
                    step="0.01"
                    value={freq.discountPercent}
                    onChange={(e) => {
                      const updated = [...serviceFrequencies];
                      updated[index].discountPercent = e.target.value;
                      setServiceFrequencies(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setServiceFrequencies(serviceFrequencies.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceFrequencies([...serviceFrequencies, { name: '', discountPercent: '0' }])}
              >
                + Add Frequency
              </Button>
            </div>
          </div>
        )}

        {/* CUSTOM QUOTE: Minimum Price only */}
        {pricingType === 'custom_quote' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Custom Quote Pricing</h4>
            <p className="text-xs text-muted-foreground">
              Customer will describe their needs and your team will contact them with a quote.
              A minimum charge applies to the booking.
            </p>

            <div className="space-y-2">
              <Label>Minimum Price (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={minimumPrice}
                onChange={(e) => {
                  setMinimumPrice(e.target.value);
                  setPrice(e.target.value); // Also set main price
                }}
                placeholder="150.00"
                required
              />
            </div>
          </div>
        )}

        {/* Hidden price field for non-fixed types */}
        {pricingType !== 'fixed_item' && (
          <input
            type="hidden"
            name="price"
            value={pricingType === 'area_based' ? (areaSizes[0]?.price || minimumPrice || '0') :
              pricingType === 'base_plus_addons' ? (basePrice || '0') :
                (minimumPrice || '0')}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="durationHours">Duration (Hours)</Label>
            <Input
              id="durationHours"
              type="number"
              min="0"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              data-testid="input-service-hours"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Duration (Minutes)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min="0"
              max="59"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              data-testid="input-service-minutes"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Service Image</Label>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
            data-testid="input-service-image-upload"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-dashed border-border cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-center group"
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl.startsWith('/objects/') ? imageUrl : imageUrl}
                  alt="Service preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white flex flex-col items-center gap-2">
                    <Pencil className="h-8 w-8" />
                    <span className="text-sm font-medium">Change Image</span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center border shadow-sm">
                  <Image className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs">4:3 aspect ratio recommended</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="isHidden"
            checked={isHidden}
            onCheckedChange={(checked) => setIsHidden(!!checked)}
            data-testid="checkbox-service-hidden"
          />
          <Label htmlFor="isHidden" className="text-sm font-normal cursor-pointer">
            Hide from main services list (Service will only show as add-on)
          </Label>
        </div>

        {service && allServices.length > 1 && (
          <div className="space-y-2 pt-2">
            <Label>Suggested Add-ons</Label>
            <p className="text-xs text-muted-foreground">Choose which services to suggest when this is added</p>
            <div className="space-y-2 border rounded-md p-3 bg-muted">
              <Input
                placeholder="Search services..."
                value={addonSearch}
                onChange={(e) => setAddonSearch(e.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {availableAddons.length > 0 ? (
                  availableAddons.map(addon => (
                    <div key={addon.id} className="flex items-center space-x-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-1 transition-colors">
                      <Checkbox
                        id={`addon-${addon.id}`}
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => handleAddonToggle(addon.id)}
                        data-testid={`checkbox-addon-${addon.id}`}
                      />
                      <Label htmlFor={`addon-${addon.id}`} className="text-sm font-normal cursor-pointer flex-1 flex justify-between items-center">
                        <span className="truncate">{addon.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">${addon.price}</span>
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center py-4 text-muted-foreground">No services found</p>
                )}
              </div>
              {selectedAddons.length > 0 && (
                <div className="pt-2 border-t mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground w-full mb-1">Selected:</span>
                  {selectedAddons.map(id => {
                    const s = allServices.find(as => as.id === id);
                    if (!s) return null;
                    return (
                      <Badge key={id} variant="secondary" className="text-[10px] py-0 h-5 border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {s.name}
                        <button
                          onClick={(e) => { e.preventDefault(); handleAddonToggle(id); }}
                          className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          x
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-service">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {service ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface BookingItem {
  id: number;
  bookingId: number;
  serviceId: number;
  serviceName: string;
  price: string;
  quantity?: number;
}

interface BookingEditItem {
  serviceId: number;
  serviceName: string;
  price: string;
  quantity: number;
}

type BookingUpdatePayload = Partial<{
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  customerAddress: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  totalPrice: string;
}> & {
  bookingItems?: BookingEditItem[];
};

function getBookingStatusColor(status: string) {
  switch (status) {
    case 'pending': return 'bg-warning/10 text-warning dark:text-warning border-warning/20';
    case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
    case 'completed': return 'bg-success/10 text-success border-success/20';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function useBookingItems(bookingId: number, enabled: boolean = true) {
  return useQuery<BookingItem[]>({
    queryKey: ['/api/bookings', bookingId, 'items'],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}/items`);
      return res.json();
    },
    enabled
  });
}

function BookingEditDialog({
  booking,
  services,
  bookingItems,
  open,
  onOpenChange,
  onSave,
  isSaving
}: {
  booking: Booking;
  services: Service[];
  bookingItems: BookingItem[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: BookingUpdatePayload) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    customerName: booking.customerName || '',
    customerEmail: booking.customerEmail || '',
    customerPhone: booking.customerPhone || '',
    customerAddress: booking.customerAddress || '',
    bookingDate: booking.bookingDate || '',
    startTime: booking.startTime || '',
    endTime: booking.endTime || ''
  });
  const [items, setItems] = useState<BookingEditItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setFormData({
      customerName: booking.customerName || '',
      customerEmail: booking.customerEmail || '',
      customerPhone: booking.customerPhone || '',
      customerAddress: booking.customerAddress || '',
      bookingDate: booking.bookingDate || '',
      startTime: booking.startTime || '',
      endTime: booking.endTime || ''
    });
  }, [open, booking]);

  useEffect(() => {
    if (!open) return;
    if (bookingItems) {
      setItems(
        bookingItems.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          quantity: item.quantity ?? 1
        }))
      );
    }
  }, [open, bookingItems]);

  const totalPrice = items
    .reduce((sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1), 0)
    .toFixed(2);

  const addItem = () => {
    if (services.length === 0) return;
    const service = services[0];
    setItems((prev) => [
      ...prev,
      {
        serviceId: service.id,
        serviceName: service.name,
        price: String(service.price ?? '0'),
        quantity: 1
      }
    ]);
  };

  const updateItem = (index: number, updates: Partial<BookingEditItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (items.length === 0) return;
    onSave({
      ...formData,
      customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : null,
      totalPrice,
      bookingItems: items
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Booking</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`booking-name-${booking.id}`}>Customer name</Label>
              <Input
                id={`booking-name-${booking.id}`}
                value={formData.customerName}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-email-${booking.id}`}>Email</Label>
              <Input
                id={`booking-email-${booking.id}`}
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-phone-${booking.id}`}>Phone</Label>
              <Input
                id={`booking-phone-${booking.id}`}
                value={formData.customerPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-address-${booking.id}`}>Address</Label>
              <Input
                id={`booking-address-${booking.id}`}
                value={formData.customerAddress}
                onChange={(e) => setFormData((prev) => ({ ...prev, customerAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-date-${booking.id}`}>Date</Label>
              <Input
                id={`booking-date-${booking.id}`}
                type="date"
                value={formData.bookingDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, bookingDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-start-${booking.id}`}>Start time</Label>
              <Input
                id={`booking-start-${booking.id}`}
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`booking-end-${booking.id}`}>End time</Label>
              <Input
                id={`booking-end-${booking.id}`}
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Services</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                disabled={services.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add service
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add at least one service.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.serviceId}-${index}`}
                    className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_40px] gap-2 items-end"
                  >
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Service</Label>}
                      <Select
                        value={String(item.serviceId)}
                        onValueChange={(value) => {
                          const service = services.find((s) => s.id === Number(value));
                          if (!service) return;
                          updateItem(index, {
                            serviceId: service.id,
                            serviceName: service.name,
                            price: String(service.price ?? '0')
                          });
                        }}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {!services.some((service) => service.id === item.serviceId) && (
                            <SelectItem value={String(item.serviceId)}>
                              {item.serviceName} (removed)
                            </SelectItem>
                          )}
                          {services.map((service) => (
                            <SelectItem key={service.id} value={String(service.id)}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Qty</Label>}
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Number(e.target.value || 1) })}
                      />
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <Label className="text-xs">Price</Label>}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => updateItem(index, { price: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-600 hover:text-red-700"
                        onClick={() => removeItem(index)}
                        aria-label="Remove service"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">${totalPrice}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving || items.length === 0}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingRow({ booking, services, onUpdate, onDelete, isSaving }: {
  booking: Booking;
  services: Service[];
  onUpdate: (id: number, updates: BookingUpdatePayload) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();

  const { data: bookingItems } = useBookingItems(booking.id, expanded || isEditOpen);

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <>
      <tr className="hover:bg-muted/30 dark:hover:bg-slate-700/30 transition-colors">
        <td className="px-6 py-4">
          <div className="flex flex-wrap items-start gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{booking.customerName}</p>
              <p className="text-xs text-slate-500">{booking.customerEmail}</p>
              <p className="text-xs text-slate-400">{booking.customerPhone}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-expand-booking-${booking.id}`}
              >
                <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", expanded && "rotate-180")} />
                {expanded ? 'Hide services' : 'Show services'}
              </Button>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {format(new Date(booking.bookingDate), "MMM dd, yyyy")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {booking.startTime} - {booking.endTime}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
            <span className="truncate max-w-[200px]" title={booking.customerAddress}>
              {booking.customerAddress}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 align-middle">
          <div className="flex items-center min-h-[56px]">
            <Select value={booking.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[140px] h-10 text-xs" data-testid={`select-status-${booking.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-warning/40 bg-warning/15" />
                    Pending
                  </span>
                </SelectItem>
                <SelectItem value="confirmed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-primary/40 bg-primary/15" />
                    Confirmed
                  </span>
                </SelectItem>
                <SelectItem value="completed">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-secondary/70 bg-secondary/40" />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value="cancelled">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-destructive/40 bg-destructive/15" />
                    Cancelled
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </td>
        <td className="px-6 py-4">
          <Select value={booking.paymentStatus} onValueChange={handlePaymentChange}>
            <SelectTrigger className="w-[120px] h-10 text-xs" data-testid={`select-payment-${booking.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-emerald-500/40 bg-emerald-500/15" />
                  Paid
                </span>
              </SelectItem>
              <SelectItem value="unpaid">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-muted-foreground/30 bg-muted-foreground/15" />
                  Unpaid
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-6 py-4">
          <span
            className="font-bold text-foreground"
            data-testid={`text-amount-${booking.id}`}
          >
            ${booking.totalPrice}
          </span>
        </td>
        <td className="px-6 py-4 text-right align-middle">
          <div className="flex items-center justify-end min-h-[56px]">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 items-center justify-center"
              onClick={() => setIsEditOpen(true)}
              data-testid={`button-edit-booking-${booking.id}`}
              aria-label="Edit booking"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 items-center justify-center"
                  data-testid={`button-delete-booking-${booking.id}`}
                  aria-label="Delete booking"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the booking for {booking.customerName}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(booking.id)}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>
      </tr>
      <BookingEditDialog
        booking={booking}
        services={services}
        bookingItems={bookingItems}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSave={(updates) => {
          onUpdate(booking.id, updates);
          toast({ title: 'Booking updated' });
        }}
        isSaving={isSaving}
      />
      {expanded && (
        <tr className="bg-muted/60">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">Booked Services</h4>
              {bookingItems && bookingItems.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-slate-700">
                  {bookingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.serviceName}</span>
                      <span className="text-sm font-medium text-foreground">${item.price}</span>
                    </div>
                  ))}
                  <div className="h-px bg-gray-200 dark:bg-slate-700" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Loading services...</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function BookingMobileCard({
  booking,
  services,
  onUpdate,
  onDelete,
  isSaving
}: {
  booking: Booking;
  services: Service[];
  onUpdate: (id: number, data: BookingUpdatePayload) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { toast } = useToast();
  const { data: items, isLoading: itemsLoading } = useBookingItems(booking.id, isExpanded || isEditOpen);
  const isItemsLoading = isExpanded && itemsLoading;

  const handleStatusChange = (status: string) => {
    onUpdate(booking.id, { status });
    toast({ title: `Status changed to ${status}` });
  };

  const handlePaymentStatusChange = (paymentStatus: string) => {
    onUpdate(booking.id, { paymentStatus });
    toast({ title: `Payment status changed to ${paymentStatus}` });
  };

  return (
    <Card className="mb-4 overflow-hidden border-0 bg-card/70 dark:bg-slate-900/70">
      <CardHeader className="p-4 pb-3 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-base truncate">{booking.customerName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(booking.bookingDate), 'MMM dd, yyyy')} • {booking.startTime} - {booking.endTime}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">${booking.totalPrice}</p>
            <p className="text-xs text-muted-foreground">#{booking.id}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="w-4 h-4 mt-0.5" />
          <span className="truncate">{booking.customerAddress}</span>
        </div>

        <div className="grid gap-2">
          <Select onValueChange={handleStatusChange} defaultValue={booking.status}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select onValueChange={handlePaymentStatusChange} defaultValue={booking.paymentStatus}>
            <SelectTrigger className="h-9 text-xs w-full">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown className={clsx("w-3.5 h-3.5 mr-1 transition-transform", isExpanded && "rotate-180")} />
            {isExpanded ? 'Hide services' : 'Show services'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditOpen(true)}
            data-testid={`button-edit-booking-mobile-${booking.id}`}
            aria-label="Edit booking"
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(booking.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <BookingEditDialog
          booking={booking}
          services={services}
          bookingItems={items}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          onSave={(updates) => {
            onUpdate(booking.id, updates);
            toast({ title: 'Booking updated' });
          }}
          isSaving={isSaving}
        />

        {isExpanded && (
          <div className="mt-2 p-3 bg-card/70 dark:bg-slate-900/70 rounded-md space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</h4>
            {isItemsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : items && items.length > 0 ? (
              <ul className="space-y-1">
                {items.map((item: any) => (
                  <li key={item.id} className="text-sm flex justify-between items-center">
                    <span>{item.serviceName}</span>
                    <span className="font-medium">${item.price}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No services listed</p>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-muted-foreground">
              <p>Email: {booking.customerEmail}</p>
              <p>Phone: {booking.customerPhone}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BookingsSection() {
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['/api/bookings']
  });
  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });
  const { toast } = useToast();
  const [bookingView, setBookingView] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const filteredBookings = useMemo(() => {
    const list = bookings || [];
    if (list.length === 0) return [];
    const now = new Date();

    return list.filter((booking) => {
      const time = booking.endTime || booking.startTime || '00:00';
      const dateTime = new Date(`${booking.bookingDate}T${time}`);
      const bookingIsPast = Number.isNaN(dateTime.getTime())
        ? new Date(booking.bookingDate) < now
        : dateTime < now;

      if (bookingView === 'all') return true;
      if (bookingView === 'past') return bookingIsPast;
      return !bookingIsPast;
    });
  }, [bookings, bookingView]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: BookingUpdatePayload }) => {
      const res = await apiRequest('PATCH', `/api/bookings/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
      toast({ title: 'Booking deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleUpdate = (id: number, updates: BookingUpdatePayload) => {
    updateMutation.mutate({ id, updates });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-muted-foreground">Manage all customer bookings</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm font-semibold px-4 py-2 border-0 bg-muted dark:text-white">
            {filteredBookings.length} Total
          </Badge>
          <Select value={bookingView} onValueChange={(value) => setBookingView(value as 'upcoming' | 'past' | 'all')}>
            <SelectTrigger className="h-10 w-[150px] px-4 border-0 bg-muted text-sm font-semibold shadow-none" data-testid="select-bookings-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {bookings?.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-card border border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings yet</h3>
          <p className="text-muted-foreground">Bookings will appear here when customers make them</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center rounded-lg bg-card border border-border">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No bookings in this view</h3>
          <p className="text-muted-foreground">Try switching the filter to see past or upcoming bookings</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="hidden xl:block bg-muted rounded-lg overflow-hidden transition-all">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 dark:bg-slate-700/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4 text-left">Customer</th>
                    <th className="px-6 py-4 text-left">Schedule</th>
                    <th className="px-6 py-4 text-left">Address</th>
                    <th className="px-6 py-4 text-left">Status</th>
                    <th className="px-6 py-4 text-left">Payment</th>
                    <th className="px-6 py-4 text-left">Amount</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-card/70 dark:bg-slate-800/70 divide-y divide-gray-200/70 dark:divide-slate-600/40">
                  {filteredBookings.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      services={services}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      isSaving={updateMutation.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="xl:hidden space-y-4">
            {filteredBookings.map((booking) => (
              <BookingMobileCard
                key={booking.id}
                booking={booking}
                services={services}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                isSaving={updateMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableFaqItem({ faq, onEdit, onDelete, onToggle }: {
  faq: Faq;
  onEdit: (faq: Faq) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: faq.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-lg bg-muted transition-all group relative"
      data-testid={`faq-item-${faq.id}`}
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-base line-clamp-1">{faq.question}</h3>
            {!faq.isActive && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted-foreground/20 text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-xs line-clamp-2">{faq.answer}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 px-2">
            <Switch
              checked={faq.isActive}
              onCheckedChange={(checked) => onToggle(faq.id, checked)}
              data-testid={`switch-faq-active-${faq.id}`}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(faq)}
            data-testid={`button-edit-faq-${faq.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-delete-faq-${faq.id}`}>
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete FAQ?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(faq.id)}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function FaqsSection() {
  const { toast } = useToast();
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const scrollPositionRef = useRef<number>(0);

  const { data: faqs, isLoading } = useQuery<Faq[]>({
    queryKey: ['/api/faqs', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/faqs?includeInactive=1');
      if (!res.ok) throw new Error('Failed to load FAQs');
      return res.json();
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createFaq = useMutation({
    mutationFn: async (data: { question: string; answer: string; order: number; isActive: boolean }) => {
      return apiRequest('POST', '/api/faqs', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs', 'all'] });
      toast({ title: 'FAQ created successfully' });
      setIsDialogOpen(false);
      // Restore scroll position after state updates complete
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const updateFaq = useMutation({
    mutationFn: async (data: { id: number; question: string; answer: string; order: number; isActive: boolean }) => {
      return apiRequest('PUT', `/api/faqs/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs', 'all'] });
      toast({ title: 'FAQ updated successfully' });
      setEditingFaq(null);
      setIsDialogOpen(false);
      // Restore scroll position after state updates complete
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const deleteFaq = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/faqs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs', 'all'] });
      toast({ title: 'FAQ deleted successfully' });
      // Restore scroll position after state updates complete
      setTimeout(() => {
        window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
      }, 0);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const toggleFaq = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest('PUT', `/api/faqs/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs', 'all'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle FAQ', description: error.message, variant: 'destructive' });
    }
  });

  const reorderFaqs = useMutation({
    mutationFn: async (newOrder: { id: number; order: number }[]) => {
      return Promise.all(
        newOrder.map(item => apiRequest('PUT', `/api/faqs/${item.id}`, { order: item.order }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/faqs'] });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && faqs) {
      const oldIndex = faqs.findIndex((f) => f.id === active.id);
      const newIndex = faqs.findIndex((f) => f.id === over.id);

      const newFaqs = arrayMove(faqs, oldIndex, newIndex);
      const updates = newFaqs.map((faq, index) => ({
        id: faq.id,
        order: index
      }));

      reorderFaqs.mutate(updates);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">FAQs</h1>
          <p className="text-muted-foreground">Manage frequently asked questions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (open) {
            scrollPositionRef.current = window.scrollY;
          } else {
            setEditingFaq(null);
          }
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-faq">
              <Plus className="w-4 h-4 mr-2" />
              Add FAQ
            </Button>
          </DialogTrigger>
          <DialogContent>
            <FaqForm
              faq={editingFaq}
              onSubmit={(data) => {
                if (editingFaq) {
                  updateFaq.mutate({ ...data, id: editingFaq.id });
                } else {
                  createFaq.mutate(data);
                }
              }}
              isLoading={createFaq.isPending || updateFaq.isPending}
              nextOrder={faqs?.length || 0}
            />
          </DialogContent>
        </Dialog>
      </div>

      {faqs?.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-lg">
          <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No FAQs yet</h3>
          <p className="text-muted-foreground mb-4">Create FAQs to help your customers find answers quickly</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={faqs?.map(f => f.id) || []}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-2">
              {faqs?.map((faq) => (
                <SortableFaqItem
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => {
                    scrollPositionRef.current = window.scrollY;
                    setEditingFaq(f);
                    setIsDialogOpen(true);
                  }}
                  onDelete={(id) => deleteFaq.mutate(id)}
                  onToggle={(id, isActive) => toggleFaq.mutate({ id, isActive })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function FaqForm({ faq, onSubmit, isLoading, nextOrder }: {
  faq: Faq | null;
  onSubmit: (data: { question: string; answer: string; order: number; isActive: boolean }) => void;
  isLoading: boolean;
  nextOrder: number;
}) {
  const [question, setQuestion] = useState(faq?.question || '');
  const [answer, setAnswer] = useState(faq?.answer || '');
  const [order, setOrder] = useState(faq?.order ?? nextOrder);
  const [isActive, setIsActive] = useState(faq?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ question, answer, order, isActive });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{faq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="faq-question">Question</Label>
          <Input
            id="faq-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required
            placeholder="e.g., How do I book a service?"
            data-testid="input-faq-question"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-answer">Answer</Label>
          <Textarea
            id="faq-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            placeholder="Provide a helpful answer..."
            rows={4}
            data-testid="input-faq-answer"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="faq-order">Display Order</Label>
          <Input
            id="faq-order"
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            min={0}
            data-testid="input-faq-order"
          />
          <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="faq-active">Active</Label>
            <p className="text-xs text-muted-foreground">Show this FAQ on the website and in chat</p>
          </div>
          <Switch
            id="faq-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid="switch-faq-active"
          />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-faq">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {faq ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}


type UrlRule = {
  pattern: string;
  match: 'contains' | 'starts_with' | 'equals';
};





interface ConversationSummary {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  firstPageUrl?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  lastMessage?: string;
  lastMessageRole?: string | null;
  messageCount?: number;
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, any> | null;
}

function ChatSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settingsDraft, setSettingsDraft] = useState<ChatSettingsData>({
    enabled: false,
    agentName: 'Skleanings Assistant',
    agentAvatarUrl: '',
    welcomeMessage: 'Hi! How can I help you today?',
    calendarProvider: 'gohighlevel',
    calendarId: '',
    calendarStaff: [],
    intakeObjectives: [],
    excludedUrlRules: [],
    useFaqs: true,
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [showDebugMessages, setShowDebugMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const objectivesSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastServerData = useRef<any>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [pageIndex, setPageIndex] = useState(0);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: settings, isLoading: loadingSettings } = useQuery<ChatSettingsData>({
    queryKey: ['/api/chat/settings'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/chat/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch chat settings');
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: companySettings } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings'],
  });

  const { data: conversations, isLoading: loadingConversations, refetch: refetchConversations } = useQuery<ConversationSummary[]>({
    queryKey: ['/api/chat/conversations'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await fetch('/api/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      return res.json();
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  const { data: openaiSettings } = useQuery<{ enabled: boolean; hasKey: boolean }>({
    queryKey: ['/api/integrations/openai'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/openai', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch OpenAI settings');
      return res.json();
    },
  });

  const { data: ghlStatus } = useQuery<{
    chatEnabled: boolean;
    ghlEnabled: boolean;
    hasApiKey: boolean;
    hasLocationId: boolean;
    hasCalendarId: boolean;
    calendarProvider: string;
    calendarId: string;
    ready: boolean;
    issues: string[];
  }>({
    queryKey: ['/api/chat/ghl-status'],
    staleTime: 30000,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!settings && !companySettings) return;

    const defaultName = companySettings?.companyName || 'Skleanings Assistant';

    if (settings) {
      const hasCustomName = settings.agentName && settings.agentName !== 'Skleanings Assistant';

      if (isInitialLoadRef.current || JSON.stringify(settings) !== JSON.stringify(lastServerData.current)) {
        setSettingsDraft({
          enabled: settings.enabled,
          agentName: hasCustomName ? settings.agentName : defaultName,
          agentAvatarUrl: settings.agentAvatarUrl ?? '',
          welcomeMessage: settings.welcomeMessage ?? 'Hi! How can I help you today?',
          calendarProvider: settings.calendarProvider ?? 'gohighlevel',
          calendarId: settings.calendarId ?? '',
          calendarStaff: settings.calendarStaff || [],
          intakeObjectives: settings.intakeObjectives && settings.intakeObjectives.length > 0
            ? settings.intakeObjectives
            : DEFAULT_CHAT_OBJECTIVES,
          excludedUrlRules: settings.excludedUrlRules || [],
          useFaqs: settings.useFaqs ?? true,
        });
        lastServerData.current = settings;
      }
      isInitialLoadRef.current = false;
      return;
    }

    if (isInitialLoadRef.current) {
      setSettingsDraft((prev) => ({
        ...prev,
        agentName: prev.agentName || defaultName,
        agentAvatarUrl: prev.agentAvatarUrl || '',
        intakeObjectives: prev.intakeObjectives && prev.intakeObjectives.length > 0
          ? prev.intakeObjectives
          : DEFAULT_CHAT_OBJECTIVES,
        calendarProvider: prev.calendarProvider || 'gohighlevel',
        calendarId: prev.calendarId || '',
        calendarStaff: prev.calendarStaff || [],
        excludedUrlRules: prev.excludedUrlRules || [],
        useFaqs: prev.useFaqs ?? true,
      }));
      isInitialLoadRef.current = false;
    }
  }, [settings, companySettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (dataToSave: Partial<ChatSettingsData>) => {
    console.log('saveSettings called with:', dataToSave);
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      const response = await authenticatedRequest('PUT', '/api/chat/settings', token, dataToSave);
      const updatedSettings = await response.json();
      console.log('Server returned:', updatedSettings);
      queryClient.setQueryData(['/api/chat/settings'], updatedSettings);
      setLastSaved(new Date());
      toast({ title: 'Settings saved', description: 'Changes saved successfully', variant: 'default' });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const updateField = useCallback(<K extends keyof ChatSettingsData>(field: K, value: ChatSettingsData[K]) => {
    setSettingsDraft(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const handleToggleChat = async (checked: boolean) => {
    const previousValue = settingsDraft.enabled;
    setSettingsDraft(prev => ({ ...prev, enabled: checked }));
    try {
      await saveSettings({ enabled: checked });
      await queryClient.refetchQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error) {
      setSettingsDraft(prev => ({ ...prev, enabled: previousValue }));
    }
  };

  const addRule = () => {
    const currentRules = settingsDraft.excludedUrlRules || [];
    const newRules = [...currentRules, { pattern: '', match: 'starts_with' as const }];
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const updateRule = (index: number, field: keyof UrlRule, value: string) => {
    const currentRules = settingsDraft.excludedUrlRules || [];
    if (index < 0 || index >= currentRules.length) return;
    const rules = [...currentRules];
    rules[index] = { ...rules[index], [field]: value } as UrlRule;
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: rules }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ excludedUrlRules: rules });
    }, 800);
  };

  const removeRule = (index: number) => {
    const currentRules = settingsDraft.excludedUrlRules || [];
    if (index < 0 || index >= currentRules.length) return;
    const newRules = currentRules.filter((_, i) => i !== index);
    setSettingsDraft(prev => ({ ...prev, excludedUrlRules: newRules }));
    saveSettings({ excludedUrlRules: newRules });
  };

  const handleObjectivesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = (settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES) as IntakeObjective[];
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: reordered }));
    saveSettings({ intakeObjectives: reordered });
  };

  const toggleObjective = (id: IntakeObjective['id'], enabled: boolean) => {
    const items = (settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES) as IntakeObjective[];
    const updated = items.map((item) => item.id === id ? { ...item, enabled } : item);
    setSettingsDraft((prev) => ({ ...prev, intakeObjectives: updated }));
    saveSettings({ intakeObjectives: updated });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setSettingsDraft(prev => ({ ...prev, agentAvatarUrl: objectPath }));
      await saveSettings({ agentAvatarUrl: objectPath });
      toast({ title: 'Avatar uploaded', description: 'Chat assistant avatar updated.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const openConversation = async (conv: ConversationSummary) => {
    setSelectedConversation(conv);
    setIsMessagesLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const url = `/api/chat/conversations/${conv.id}/messages?includeInternal=true`;
      const res = await authenticatedRequest('GET', url, token);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error: any) {
      toast({ title: 'Failed to load conversation', description: error.message, variant: 'destructive' });
      setSelectedConversation(null);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const toggleDebugMessages = () => {
    setShowDebugMessages(!showDebugMessages);
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('POST', `/api/chat/conversations/${id}/status`, token, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      if (selectedConversation) {
        setSelectedConversation({ ...selectedConversation, status: selectedConversation.status === 'open' ? 'closed' : 'open' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('DELETE', `/api/chat/conversations/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConversation(null);
      setMessages([]);
      toast({ title: 'Conversation deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete conversation', description: error.message, variant: 'destructive' });
    },
  });

  const statusBadge = (status: string) => {
    const label = status === 'closed' ? 'Archived' : status === 'open' ? 'Open' : status;
    const badgeClass = status === 'open'
      ? 'bg-blue-600 text-white border border-blue-500 rounded-full px-3 py-1 text-xs font-semibold shadow-sm dark:bg-blue-500 dark:border-blue-400'
      : 'bg-amber-600 text-white border border-amber-500 rounded-full px-3 py-1 text-xs font-semibold shadow-sm dark:bg-amber-500 dark:border-amber-400';
    return <span className={badgeClass}>{label}</span>;
  };

  const assistantName = settingsDraft.agentName || companySettings?.companyName || 'Assistant';
  const assistantAvatar = (settingsDraft.agentAvatarUrl && settingsDraft.agentAvatarUrl.trim())
    ? settingsDraft.agentAvatarUrl
    : (companySettings?.logoIcon || '/favicon.ico');
  const visitorName = selectedConversation?.visitorName || 'Guest';
  const openConversations = conversations?.filter((conv) => conv.status === 'open').length || 0;
  const closedConversations = conversations?.filter((conv) => conv.status === 'closed').length || 0;
  const visibleConversations = useMemo(() => {
    if (!conversations) return [];
    if (statusFilter === 'all') return conversations;
    return conversations.filter((conv) => conv.status === statusFilter);
  }, [conversations, statusFilter]);
  const totalConversations = visibleConversations.length;
  const totalPages = Math.max(1, Math.ceil(totalConversations / pageSize));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const paginatedConversations = useMemo(() => {
    const start = clampedPageIndex * pageSize;
    return visibleConversations.slice(start, start + pageSize);
  }, [visibleConversations, clampedPageIndex, pageSize]);

  useEffect(() => {
    setPageIndex(0);
  }, [statusFilter, pageSize]);

  useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [pageIndex, clampedPageIndex]);

  useEffect(() => {
    if (messages.length > 0 && !isMessagesLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isMessagesLoading]);

  useEffect(() => {
    if (!selectedConversation) return;

    const eventSource = new EventSource(`/api/chat/conversations/${selectedConversation.id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
          if (data.conversation) {
            setSelectedConversation(data.conversation);
          }
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.log('SSE connection error, will reconnect...');
    };

    return () => {
      eventSource.close();
    };
  }, [selectedConversation?.id]);

  const showChat = !!selectedConversation;
  const showList = !isMobile || !showChat;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] -m-4 md:-m-8">
      {showList && (
        <div className="px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Chat</h1>
            </div>
            <div className="flex items-center gap-2">
              <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
          {ghlStatus && !ghlStatus.ready && (
            <div className="mt-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-2 text-xs">
              <p className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-1">
                <span>⚠️</span> Issues detected
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className={clsx(
          "flex-col border-r border-border bg-muted/10 dark:bg-slate-900/20 w-full md:w-[350px] shrink-0 transition-all",
          showList ? "flex" : "hidden md:flex"
        )}>
          <div className="p-3 border-b border-border space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="h-8 pl-8 text-xs bg-background" placeholder="Search..." disabled />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetchConversations()}
                disabled={loadingConversations}
              >
                <RefreshCw className={clsx("w-4 h-4", loadingConversations && "animate-spin")} />
              </Button>
            </div>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
              {(['open', 'closed', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    "flex-1 text-[10px] uppercase font-bold py-1.5 rounded-md transition-all",
                    statusFilter === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
              </div>
            ) : paginatedConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No conversations found.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {paginatedConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={clsx(
                      "w-full text-left p-3 hover:bg-blue-50 transition-colors flex flex-col gap-1.5 focus:outline-none",
                      selectedConversation?.id === conv.id && "bg-blue-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={clsx("font-semibold text-sm truncate", !conv.visitorName && "text-muted-foreground italic")}>
                        {conv.visitorName || 'Guest'}
                      </span>
                      {conv.status === 'open' && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                      {renderMarkdown(conv.lastMessage || 'No messages')}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 pt-1">
                      <span>{conv.firstPageUrl?.split('/').pop() || 'Direct'}</span>
                      <span>{conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'MMM d, h:mm a') : ''}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-2 border-t border-border flex items-center justify-between text-xs">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                disabled={pageIndex === 0}
              >
                Prev
              </Button>
              <span className="text-muted-foreground">{pageIndex + 1} / {totalPages}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px]"
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                disabled={pageIndex >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        <div className={clsx(
          "flex-1 flex flex-col bg-background h-full overflow-hidden transition-all",
          showChat ? "flex" : "hidden md:flex"
        )}>
          {selectedConversation ? (
            <>
              <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background/95 backdrop-blur">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-8 w-8 -ml-2"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm leading-none">
                        {selectedConversation.visitorName || 'Guest'}
                      </span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {selectedConversation.visitorEmail || selectedConversation.visitorPhone || 'No contact info'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <div className="hidden md:flex items-center gap-1 mr-2">
                    {statusBadge(selectedConversation.status)}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() =>
                        statusMutation.mutate({
                          id: selectedConversation.id,
                          status: selectedConversation.status === 'open' ? 'closed' : 'open',
                        })
                      }>
                        {selectedConversation.status === 'open' ? <Archive className="w-4 h-4 mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                        {selectedConversation.status === 'open' ? 'Archive' : 'Reopen'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          deleteMutation.mutate(selectedConversation.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
                {isMessagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground"
                        onClick={toggleDebugMessages}
                      >
                        {showDebugMessages ? 'Hide' : 'Show'} System Messages
                      </Button>
                    </div>

                    {messages.filter((msg) => showDebugMessages || !msg.metadata?.internal).map((msg) => {
                      const isInternal = msg.metadata?.internal === true;
                      const isAssistant = msg.role === 'assistant';

                      if (isInternal) {
                        return (
                          <div key={msg.id} className="text-xs font-mono p-2 bg-muted rounded border opacity-70">
                            <div className="font-bold mb-1">[SYSTEM] {msg.metadata?.type}</div>
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={clsx("flex gap-3", isAssistant ? "flex-row" : "flex-row-reverse")}>
                          <div className={clsx(
                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                            isAssistant
                              ? "bg-white dark:bg-slate-800 border border-border"
                              : "bg-primary text-primary-foreground"
                          )}>
                            <div className="whitespace-pre-wrap leading-relaxed">{renderMarkdown(msg.content)}</div>
                            <div className={clsx("text-[10px] mt-1 opacity-70", isAssistant ? "text-left" : "text-right")}>
                              {format(new Date(msg.createdAt), 'h:mm a')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="p-4 bg-background border-t border-border">
                <div className="bg-muted/50 p-2 rounded-lg text-center text-sm text-muted-foreground">
                  <p>Coming soon: Reply from Admin (currently read-only transcript)</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-medium">No conversation selected</p>
              <p className="text-sm">Choose a thread from the list to view details.</p>
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
          <div className="w-full md:w-[400px] bg-background border-l border-border h-full shadow-xl overflow-y-auto p-4 animate-in slide-in-from-right">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Chat Settings</h2>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid gap-6">
                <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <CardTitle>General Settings</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {isSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : lastSaved ? (
                            <>
                              <Check className="h-4 w-4 text-green-500" />
                              <span>Auto-saved</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm">
                          {settingsDraft.enabled ? 'Enabled' : 'Disabled'}
                        </Label>
                        <Switch
                          checked={settingsDraft.enabled}
                          onCheckedChange={handleToggleChat}
                          disabled={loadingSettings || isSaving}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-card rounded-lg border border-border/70 dark:bg-slate-900/80 dark:border-slate-800/70 p-6">
                      <h3 className="font-medium text-sm mb-4">Agent Identity</h3>
                      <div className="flex flex-col sm:flex-row gap-6">
                        {/* Avatar Section */}
                        <div className="flex flex-col gap-2 items-center shrink-0">
                          <div
                            className="relative group cursor-pointer"
                            onClick={() => avatarFileInputRef.current?.click()}
                          >
                            <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted shadow-sm transition-all group-hover:border-primary">
                              {assistantAvatar ? (
                                <img src={assistantAvatar} alt={assistantName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-secondary text-secondary-foreground">
                                  <MessageSquare className="w-10 h-10 opacity-50" />
                                </div>
                              )}
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                              {isUploadingAvatar ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                              ) : (
                                <>
                                  <Camera className="w-6 h-6 mb-1" />
                                  <span className="text-[10px] font-medium">Change</span>
                                </>
                              )}
                            </div>

                            <input
                              ref={avatarFileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarUpload}
                            />
                          </div>
                        </div>

                        {/* Inputs Section */}
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="agent-name">Agent Name</Label>
                            <Input
                              id="agent-name"
                              value={settingsDraft.agentName}
                              onChange={(e) => updateField('agentName', e.target.value)}
                              placeholder={companySettings?.companyName || 'Assistant'}
                              className="max-w-md"
                            />
                            <p className="text-[11px] text-muted-foreground">
                              This name will be displayed to visitors in the chat widget.
                            </p>
                          </div>

                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground">
                                Use image URL instead
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-2">
                              <Input
                                id="agent-avatar-url"
                                value={settingsDraft.agentAvatarUrl || ''}
                                onChange={(e) => updateField('agentAvatarUrl', e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="max-w-md h-8 text-xs"
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="welcome-message">Welcome message</Label>
                      <Textarea
                        id="welcome-message"
                        value={settingsDraft.welcomeMessage}
                        onChange={(e) => updateField('welcomeMessage', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>URL Exclusions</Label>
                          <p className="text-xs text-muted-foreground">Hide the widget on specific paths</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={addRule}>
                          <Plus className="w-4 h-4 mr-1" /> Add Rule
                        </Button>
                      </div>
                      {(!settingsDraft.excludedUrlRules || settingsDraft.excludedUrlRules.length === 0) && (
                        <div className="text-sm text-muted-foreground bg-card/80 dark:bg-slate-900/70 border border-border/60 dark:border-slate-800/60 rounded-md p-3">
                          No rules yet.
                        </div>
                      )}
                      <div className="space-y-3">
                        {(settingsDraft.excludedUrlRules || []).map((rule, idx) => (
                          <div key={`url-rule-${idx}`} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] items-center">
                            <Input
                              placeholder="/admin"
                              value={rule.pattern || ''}
                              onChange={(e) => updateRule(idx, 'pattern', e.target.value)}
                            />
                            <Select
                              value={rule.match || 'starts_with'}
                              onValueChange={(val) => updateRule(idx, 'match', val as UrlRule['match'])}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="starts_with">Starts with</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-red-500"
                              onClick={() => removeRule(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-muted dark:bg-slate-800/60 shadow-none">
                  <CardHeader>
                    <CardTitle>Intake flow</CardTitle>
                    <p className="text-sm text-muted-foreground">Data the bot collects before booking.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DndContext sensors={objectivesSensors} collisionDetection={closestCenter} onDragEnd={handleObjectivesDragEnd}>
                      <SortableContext
                        items={(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((o) => o.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((objective) => (
                            <ObjectiveRow
                              key={objective.id}
                              objective={objective}
                              onToggle={toggleObjective}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function ObjectiveRow({ objective, onToggle }: { objective: IntakeObjective; onToggle: (id: IntakeObjective['id'], enabled: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: objective.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-slate-800 dark:border-slate-700"
    >
      <button
        type="button"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-400"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium dark:text-slate-200">{objective.label}</p>
        <p className="text-xs text-muted-foreground">{objective.description}</p>
      </div>
      <Switch checked={objective.enabled} onCheckedChange={(checked) => onToggle(objective.id, checked)} />
    </div>
  );
}


interface GHLSettings {
  provider: string;
  apiKey: string;
  locationId: string;
  calendarId: string;
  isEnabled: boolean;
}

interface OpenAISettings {
  provider: string;
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

function AvailabilitySection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });
  const availabilityMenuTitle = menuItems.find((item) => item.id === 'availability')?.title ?? 'Availability & Business Hours';
  const TIMEZONE_OPTIONS = [
    { value: 'America/New_York', label: 'Eastern (America/New_York)' },
    { value: 'America/Chicago', label: 'Central (America/Chicago)' },
    { value: 'America/Denver', label: 'Mountain (America/Denver)' },
    { value: 'America/Phoenix', label: 'Arizona (America/Phoenix)' },
    { value: 'America/Los_Angeles', label: 'Pacific (America/Los_Angeles)' },
    { value: 'America/Anchorage', label: 'Alaska (America/Anchorage)' },
    { value: 'America/Honolulu', label: 'Hawaii (America/Honolulu)' },
    { value: 'America/Mexico_City', label: 'Mexico City (America/Mexico_City)' },
    { value: 'America/Sao_Paulo', label: 'Brazil (America/Sao_Paulo)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (America/Argentina/Buenos_Aires)' },
    { value: 'Europe/London', label: 'UK (Europe/London)' },
    { value: 'Europe/Paris', label: 'Europe Central (Europe/Paris)' },
  ];

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      return apiRequest('PUT', '/api/company-settings', newSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update settings', description: error.message, variant: 'destructive' });
    }
  });

  const updateField = (field: string, value: any) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ ...settings, [field]: value });
  };

  if (isLoading || !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const DEFAULT_BUSINESS_HOURS = {
    monday: { isOpen: true, start: '08:00', end: '18:00' },
    tuesday: { isOpen: true, start: '08:00', end: '18:00' },
    wednesday: { isOpen: true, start: '08:00', end: '18:00' },
    thursday: { isOpen: true, start: '08:00', end: '18:00' },
    friday: { isOpen: true, start: '08:00', end: '18:00' },
    saturday: { isOpen: false, start: '08:00', end: '18:00' },
    sunday: { isOpen: false, start: '08:00', end: '18:00' }
  };

  const formatTimeDisplay = (time24: string) => {
    const timeFormat = settings.timeFormat || '12h';
    if (timeFormat === '24h') return time24;
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{availabilityMenuTitle}</h1>
        <p className="text-muted-foreground">Manage your working hours and time display preferences</p>
      </div>

      <div className="grid gap-6">
        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Booking Constraints
          </h2>
          <div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="minimumBookingValue">Minimum Booking Value ($)</Label>
              <Input
                id="minimumBookingValue"
                type="number"
                min="0"
                step="0.01"
                value={settings.minimumBookingValue || '0'}
                onChange={(e) => updateField('minimumBookingValue', e.target.value)}
                placeholder="0.00"
                data-testid="input-minimum-booking-value"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Customers must reach this cart total before proceeding to checkout. Set to 0 to disable.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Time Display & Hours
          </h2>
          <div className="space-y-6">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="timeFormat">Time Display Format</Label>
              <Select
                value={settings.timeFormat || '12h'}
                onValueChange={(value) => updateField('timeFormat', value)}
              >
                <SelectTrigger id="timeFormat">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how times are displayed in the booking calendar
              </p>
            </div>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="timeZone">Business Time Zone</Label>
              <Select
                value={settings.timeZone || 'America/New_York'}
                onValueChange={(value) => updateField('timeZone', value)}
              >
                <SelectTrigger id="timeZone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for availability checks, chat dates, and calendar bookings
              </p>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-semibold">Business Hours by Day</Label>
              <div className="space-y-3">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const dayHours = (settings.businessHours || DEFAULT_BUSINESS_HOURS)[day];

                  return (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-card rounded-lg border border-border">
                      <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-auto">
                        <div className="w-24 capitalize font-medium text-sm">{day}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={dayHours.isOpen}
                            onCheckedChange={(checked) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], isOpen: checked };
                              updateField('businessHours', newHours);
                            }}
                          />
                          <span className="text-sm text-muted-foreground w-12">{dayHours.isOpen ? 'Open' : 'Closed'}</span>
                        </div>
                      </div>
                      {dayHours.isOpen && (
                        <div className="flex items-center gap-2 flex-1">
                          <Select
                            value={dayHours.start}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], start: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.start)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground shrink-0">to</span>
                          <Select
                            value={dayHours.end}
                            onValueChange={(value) => {
                              const newHours = { ...(settings.businessHours || DEFAULT_BUSINESS_HOURS) };
                              newHours[day] = { ...newHours[day], end: value };
                              updateField('businessHours', newHours);
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-32">
                              <SelectValue>{formatTimeDisplay(dayHours.end)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, h) => (
                                <SelectItem key={h} value={`${h.toString().padStart(2, '0')}:00`}>
                                  {formatTimeDisplay(`${h.toString().padStart(2, '0')}:00`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Set different business hours for each day of the week. Days marked as closed won't show any available time slots.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TwilioSettings {
  enabled: boolean;
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
  toPhoneNumbers: string[];
  notifyOnNewChat: boolean;
}

function TwilioSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<TwilioSettings>({
    enabled: false,
    accountSid: '',
    authToken: '',
    fromPhoneNumber: '',
    toPhoneNumbers: [],
    notifyOnNewChat: true
  });
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const { data: twilioSettings, isLoading } = useQuery<TwilioSettings>({
    queryKey: ['/api/integrations/twilio'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/twilio', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Twilio settings');
      return res.json();
    }
  });

  useEffect(() => {
    if (twilioSettings) {
      setSettings(twilioSettings);
    }
  }, [twilioSettings]);

  const isValidPhoneNumber = (phone: string): boolean => {
    return /^\+[1-9]\d{1,14}$/.test(phone);
  };

  const addPhoneNumber = () => {
    const trimmed = newPhoneNumber.trim();
    if (!trimmed) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number cannot be empty',
        variant: 'destructive'
      });
      return;
    }
    if (!isValidPhoneNumber(trimmed)) {
      toast({
        title: 'Invalid phone number',
        description: 'Phone number must be in E.164 format (e.g., +15551234567)',
        variant: 'destructive'
      });
      return;
    }
    if (settings.toPhoneNumbers.includes(trimmed)) {
      toast({
        title: 'Duplicate phone number',
        description: 'This phone number is already in the list',
        variant: 'destructive'
      });
      return;
    }
    setSettings(prev => ({
      ...prev,
      toPhoneNumbers: [...prev.toPhoneNumbers, trimmed]
    }));
    setNewPhoneNumber('');
    setTestResult('idle');
    setTestMessage(null);
  };

  const removePhoneNumber = (phone: string) => {
    setSettings(prev => ({
      ...prev,
      toPhoneNumbers: prev.toPhoneNumbers.filter(p => p !== phone)
    }));
    setTestResult('idle');
    setTestMessage(null);
  };

  const saveSettings = async () => {
    if (settings.toPhoneNumbers.length === 0) {
      toast({
        title: 'No phone numbers',
        description: 'Please add at least one phone number',
        variant: 'destructive'
      });
      return;
    }
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/twilio', token, settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: 'Twilio settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save Twilio settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (settings.toPhoneNumbers.length === 0) {
      toast({
        title: 'No phone numbers',
        description: 'Please add at least one phone number to test',
        variant: 'destructive'
      });
      return;
    }
    setIsTesting(true);
    setTestResult('idle');
    setTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTesting(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/twilio/test', token, {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        fromPhoneNumber: settings.fromPhoneNumber,
        toPhoneNumbers: settings.toPhoneNumbers
      });
      const result = await response.json();

      if (result.success) {
        setTestResult('success');
        setTestMessage(result.message || 'Test message sent successfully!');
        toast({ title: 'Test successful', description: 'Check your phone(s) for the test message.' });
      } else {
        setTestResult('error');
        setTestMessage(result.message || 'Test failed');
        toast({
          title: 'Test failed',
          description: result.message || 'Could not send test message',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setTestResult('error');
      setTestMessage(error.message || 'Connection failed');
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && testResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Twilio.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, enabled: checked };
    setSettings(newSettings);
    setIsSaving(true);
    try {
      await apiRequest('PUT', '/api/integrations/twilio', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/twilio'] });
      toast({ title: checked ? 'Twilio enabled' : 'Twilio disabled' });
    } catch (error: any) {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive'
      });
      setSettings(prev => ({ ...prev, enabled: !checked }));
    } finally {
      setIsSaving(false);
    }
  };

  const testButtonClass =
    testResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : testResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-muted">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F22F46] dark:bg-[#F22F46] flex items-center justify-center">
                <SiTwilio className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Twilio SMS</CardTitle>
                <p className="text-sm text-muted-foreground">Get SMS notifications for new chat conversations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Label className="text-sm">
                {settings.enabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                checked={settings.enabled}
                onCheckedChange={handleToggleEnabled}
                disabled={isSaving}
                data-testid="switch-twilio-enabled"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                type="text"
                value={settings.accountSid}
                onChange={(e) => setSettings(prev => ({ ...prev, accountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                data-testid="input-twilio-account-sid"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Auth Token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={settings.authToken}
                onChange={(e) => setSettings(prev => ({ ...prev, authToken: e.target.value }))}
                placeholder="••••••••••••••••••••••••••••••••"
                data-testid="input-twilio-auth-token"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-from-phone">From Phone Number</Label>
              <Input
                id="twilio-from-phone"
                type="tel"
                value={settings.fromPhoneNumber}
                onChange={(e) => setSettings(prev => ({ ...prev, fromPhoneNumber: e.target.value }))}
                placeholder="+1234567890"
                data-testid="input-twilio-from-phone"
              />
              <p className="text-xs text-muted-foreground">
                Your Twilio phone number (with country code)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Phone numbers to receive notifications</Label>

              {/* List of existing phone numbers */}
              {settings.toPhoneNumbers.length > 0 && (
                <div className="space-y-2 mb-3">
                  {settings.toPhoneNumbers.map((phone, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 bg-muted rounded-md border"
                    >
                      <span className="text-sm font-mono">{phone}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhoneNumber(phone)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-remove-phone-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input to add new phone number */}
              <div className="flex gap-2">
                <Input
                  type="tel"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhoneNumber();
                    }
                  }}
                  placeholder="+1234567890"
                  data-testid="input-new-phone-number"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPhoneNumber}
                  className="shrink-0"
                  data-testid="button-add-phone"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add phone numbers in E.164 format (e.g., +15551234567)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify-new-chat"
              checked={settings.notifyOnNewChat}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notifyOnNewChat: checked as boolean }))}
              data-testid="checkbox-notify-new-chat"
            />
            <Label htmlFor="notify-new-chat" className="text-sm font-normal cursor-pointer">
              Send SMS when a new chat conversation starts
            </Label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={saveSettings}
              disabled={isSaving}
              data-testid="button-save-twilio"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
            <Button
              variant="outline"
              className={testButtonClass}
              onClick={testConnection}
              disabled={isTesting || !settings.accountSid || !settings.authToken || !settings.fromPhoneNumber || settings.toPhoneNumbers.length === 0}
              data-testid="button-test-twilio"
            >
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {testResult === 'success' ? 'Test OK' : testResult === 'error' ? 'Test Failed' : 'Send Test SMS'}
            </Button>
          </div>

          {testMessage && (
            <div className={`p-3 rounded-lg text-sm ${testResult === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
              }`}>
              {testMessage}
            </div>
          )}

          {settings.enabled && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Check className="w-4 h-4" />
                <span className="font-medium text-sm">Twilio is enabled</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                You'll receive SMS notifications when new chat conversations start
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AnalyticsSettings {
  gtmContainerId: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  gtmEnabled: boolean;
  ga4Enabled: boolean;
  facebookPixelEnabled: boolean;
}


interface GeminiSettings {
  provider: 'gemini';
  enabled: boolean;
  model: string;
  hasKey: boolean;
}

function IntegrationsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GHLSettings>({
    provider: 'gohighlevel',
    apiKey: '',
    locationId: '',
    calendarId: '',
    isEnabled: false
  });
  const [openAISettings, setOpenAISettings] = useState<OpenAISettings>({
    provider: 'openai',
    enabled: false,
    model: 'gpt-4o-mini',
    hasKey: false
  });
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettings>({
    provider: 'gemini',
    enabled: false,
    model: 'gemini-2.5-flash',
    hasKey: false
  });

  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');

  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);

  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [isSavingGemini, setIsSavingGemini] = useState(false);

  const [openAITestResult, setOpenAITestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [openAITestMessage, setOpenAITestMessage] = useState<string | null>(null);

  const [geminiTestResult, setGeminiTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState<string | null>(null);

  const [analyticsSettings, setAnalyticsSettings] = useState<AnalyticsSettings>({
    gtmContainerId: '',
    ga4MeasurementId: '',
    facebookPixelId: '',
    gtmEnabled: false,
    ga4Enabled: false,
    facebookPixelEnabled: false
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAnalytics, setIsSavingAnalytics] = useState(false);
  const [lastSavedAnalytics, setLastSavedAnalytics] = useState<Date | null>(null);
  const saveAnalyticsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ghlTestResult, setGhlTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const integrationsMenuTitle = menuItems.find((item) => item.id === 'integrations')?.title ?? 'Integrations';

  const { data: ghlSettings, isLoading } = useQuery<GHLSettings>({
    queryKey: ['/api/integrations/ghl'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/integrations/ghl', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch GHL settings');
      return res.json();
    }
  });

  const { data: openaiSettingsData } = useQuery<OpenAISettings>({
    queryKey: ['/api/integrations/openai'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/openai', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch OpenAI settings');
      return res.json();
    }
  });

  const { data: geminiSettingsData } = useQuery<GeminiSettings>({
    queryKey: ['/api/integrations/gemini'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/integrations/gemini', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch Gemini settings');
      return res.json();
    }
  });

  const { data: chatSettingsData } = useQuery<any>({
    queryKey: ['/api/chat/settings'],
    queryFn: async () => {
      let token = await getAccessToken();
      if (!token) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        token = await getAccessToken();
      }
      if (!token) throw new Error('Authentication required');
      const res = await fetch('/api/chat/settings', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch chat settings');
      return res.json();
    }
  });

  const [activeTab, setActiveTab] = useState<string>('openai');

  const getTokenWithRetry = useCallback(async (): Promise<string | null> => {
    let token = await getAccessToken();
    if (!token) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      token = await getAccessToken();
    }
    return token;
  }, [getAccessToken]);

  useEffect(() => {
    if (chatSettingsData?.activeProvider) {
      setActiveTab(chatSettingsData.activeProvider);
    }
  }, [chatSettingsData]);

  const saveChatSettings = async (updates: any) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await authenticatedRequest('PUT', '/api/chat/settings', token, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/settings'] });
    } catch (error: any) {
      toast({
        title: 'Error saving chat settings',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const { data: companySettings } = useQuery<any>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (ghlSettings) {
      setSettings(ghlSettings);
    }
  }, [ghlSettings]);

  useEffect(() => {
    if (openaiSettingsData) {
      setOpenAISettings(openaiSettingsData);
      if (openaiSettingsData.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(openaiSettingsData.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
      }
    }
  }, [openaiSettingsData]);

  useEffect(() => {
    if (geminiSettingsData) {
      const normalizedGeminiModel =
        geminiSettingsData.model === 'gemini-1.5-flash' || geminiSettingsData.model === 'gemini-1.5-pro'
          ? 'gemini-2.5-flash'
          : geminiSettingsData.model;
      setGeminiSettings({
        ...geminiSettingsData,
        model: normalizedGeminiModel,
      });
      if (geminiSettingsData.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(geminiSettingsData.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
      }
    }
  }, [geminiSettingsData]);

  useEffect(() => {
    if (companySettings) {
      setAnalyticsSettings({
        gtmContainerId: companySettings.gtmContainerId || '',
        ga4MeasurementId: companySettings.ga4MeasurementId || '',
        facebookPixelId: companySettings.facebookPixelId || '',
        gtmEnabled: companySettings.gtmEnabled || false,
        ga4Enabled: companySettings.ga4Enabled || false,
        facebookPixelEnabled: companySettings.facebookPixelEnabled || false
      });
    }
  }, [companySettings]);

  useEffect(() => {
    return () => {
      if (saveAnalyticsTimeoutRef.current) {
        clearTimeout(saveAnalyticsTimeoutRef.current);
      }
    };
  }, []);

  const saveAnalyticsSettings = useCallback(async (newSettings: Partial<AnalyticsSettings>) => {
    setIsSavingAnalytics(true);
    try {
      await apiRequest('PUT', '/api/company-settings', newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSavedAnalytics(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving analytics settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSavingAnalytics(false);
    }
  }, [toast]);

  const updateAnalyticsField = useCallback(<K extends keyof AnalyticsSettings>(field: K, value: AnalyticsSettings[K]) => {
    setAnalyticsSettings(prev => ({ ...prev, [field]: value }));

    if (saveAnalyticsTimeoutRef.current) {
      clearTimeout(saveAnalyticsTimeoutRef.current);
    }

    saveAnalyticsTimeoutRef.current = setTimeout(() => {
      saveAnalyticsSettings({ [field]: value });
    }, 800);
  }, [saveAnalyticsSettings]);

  const saveOpenAISettings = async (settingsToSave?: Partial<OpenAISettings> & { apiKey?: string }) => {
    setIsSavingOpenAI(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') {
        payload.enabled = settingsToSave.enabled;
      }
      if (settingsToSave?.model) {
        payload.model = settingsToSave.model;
      }

      // Only send API key if it's provided and not masked
      const keyToSend = settingsToSave?.apiKey || openAIApiKey;
      if (keyToSend && keyToSend !== '********') {
        payload.apiKey = keyToSend;
      }

      // Fallback for callers that provide no explicit partial update
      if (!Object.keys(payload).length) {
        payload.enabled = openAISettings.enabled;
        payload.model = openAISettings.model;
      }

      const token = await getTokenWithRetry();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return false;
      }
      const response = await authenticatedRequest('PUT', '/api/integrations/openai', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
      setOpenAISettings((prev) => ({
        ...prev,
        ...updated,
        provider: 'openai',
      }));

      // Clear local input but keep hasKey state
      if (keyToSend) {
        setOpenAIApiKey('');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
      }

      toast({ title: 'OpenAI settings saved' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to save OpenAI settings',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingOpenAI(false);
    }
  };

  const saveGeminiSettings = async (settingsToSave?: Partial<GeminiSettings> & { apiKey?: string }) => {
    setIsSavingGemini(true);
    try {
      const payload: any = {};
      if (settingsToSave && 'enabled' in settingsToSave && typeof settingsToSave.enabled === 'boolean') {
        payload.enabled = settingsToSave.enabled;
      }
      if (settingsToSave?.model) {
        payload.model = settingsToSave.model;
      }

      const keyToSend = settingsToSave?.apiKey || geminiApiKey;
      if (keyToSend && keyToSend !== '********') {
        payload.apiKey = keyToSend;
      }

      // Fallback for callers that provide no explicit partial update
      if (!Object.keys(payload).length) {
        payload.enabled = geminiSettings.enabled;
        payload.model = geminiSettings.model;
      }

      const token = await getTokenWithRetry();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return false;
      }
      const response = await authenticatedRequest('PUT', '/api/integrations/gemini', token, payload);
      const updated = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
      setGeminiSettings((prev) => ({
        ...prev,
        ...updated,
        provider: 'gemini',
      }));

      if (keyToSend) {
        setGeminiApiKey('');
        setGeminiSettings(prev => ({ ...prev, hasKey: true }));
      }

      toast({ title: 'Gemini settings saved' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Failed to save Gemini settings',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSavingGemini(false);
    }
  };


  const handleToggleOpenAI = async (checked: boolean) => {
    if (checked && !(openAITestResult === 'success' || openAISettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling OpenAI.',
        variant: 'destructive'
      });
      return;
    }
    const previous = openAISettings;
    const next = { ...previous, enabled: checked };
    setOpenAISettings(next);
    if (checked) {
      setOpenAITestResult('success');
      setOpenAITestMessage('OpenAI is enabled.');
    } else {
      setOpenAITestResult('idle');
      setOpenAITestMessage(null);
    }
    const saved = await saveOpenAISettings({ enabled: checked });
    if (!saved) {
      setOpenAISettings(previous);
      if (previous.hasKey) {
        setOpenAITestResult('success');
        setOpenAITestMessage(previous.enabled ? 'OpenAI is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setOpenAITestResult('idle');
        setOpenAITestMessage(null);
      }
    }
  };

  const handleToggleGemini = async (checked: boolean) => {
    if (checked && !(geminiTestResult === 'success' || geminiSettings.hasKey)) {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling Gemini.',
        variant: 'destructive'
      });
      return;
    }
    const previous = geminiSettings;
    const next = { ...previous, enabled: checked };
    setGeminiSettings(next);
    if (checked) {
      setGeminiTestResult('success');
      setGeminiTestMessage('Gemini is enabled.');
    } else {
      setGeminiTestResult('idle');
      setGeminiTestMessage(null);
    }
    const saved = await saveGeminiSettings({ enabled: checked });
    if (!saved) {
      setGeminiSettings(previous);
      if (previous.hasKey) {
        setGeminiTestResult('success');
        setGeminiTestMessage(previous.enabled ? 'Gemini is enabled.' : 'Key saved. Run test to verify connection.');
      } else {
        setGeminiTestResult('idle');
        setGeminiTestMessage(null);
      }
    }
  };


  const testOpenAIConnection = async () => {
    setIsTestingOpenAI(true);
    setOpenAITestResult('idle');
    setOpenAITestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTestingOpenAI(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/openai/test', token, {
        apiKey: openAIApiKey || undefined,
        model: openAISettings.model
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setOpenAITestResult('success');
        setOpenAITestMessage('Connection successful. You can now enable OpenAI.');
        setOpenAISettings(prev => ({ ...prev, hasKey: true }));
        setOpenAIApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/openai'] });
        toast({ title: 'OpenAI connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setOpenAITestResult('error');
        setOpenAITestMessage(result.message || 'Could not reach OpenAI.');
        toast({
          title: 'OpenAI test failed',
          description: result.message || 'Could not reach OpenAI',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'OpenAI test failed',
        description: error.message,
        variant: 'destructive'
      });
      setOpenAITestResult('error');
      setOpenAITestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingOpenAI(false);
    }
  };


  const testGeminiConnection = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult('idle');
    setGeminiTestMessage(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTestingGemini(false);
        return;
      }

      // Pass model to test endpoint
      const response = await authenticatedRequest('POST', '/api/integrations/gemini/test', token, {
        apiKey: geminiApiKey || undefined,
        model: geminiSettings.model
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      let result: any = {};
      if (contentType.includes('application/json')) {
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          result = { success: false, message: text || 'Unexpected response from server' };
        }
      } else {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 140);
        result = {
          success: false,
          message: `Unexpected response (status ${response.status}, content-type: ${contentType || 'unknown'}). The API route may not be running. Try restarting the server and testing again. Snippet: ${snippet}`
        };
      }
      if (result.success) {
        setGeminiTestResult('success');
        setGeminiTestMessage('Connection successful. You can now enable Gemini.');
        setGeminiSettings(prev => ({ ...prev, hasKey: true }));
        setGeminiApiKey('');
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/gemini'] });
        toast({ title: 'Gemini connected', description: 'API key saved. You can now enable the integration.' });
      } else {
        setGeminiTestResult('error');
        setGeminiTestMessage(result.message || 'Could not reach Gemini.');
        toast({
          title: 'Gemini test failed',
          description: result.message || 'Could not reach Gemini',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Gemini test failed',
        description: error.message,
        variant: 'destructive'
      });
      setGeminiTestResult('error');
      setGeminiTestMessage(error.message || 'Connection failed.');
    } finally {
      setIsTestingGemini(false);
    }
  };


  const ghlTestButtonClass =
    ghlTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : ghlTestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const openAITestButtonClass =
    openAITestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : openAITestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const geminiTestButtonClass =
    geminiTestResult === 'success'
      ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
      : geminiTestResult === 'error'
        ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
        : '';

  const hasGtmId = analyticsSettings.gtmContainerId.trim().length > 0;
  const hasGa4Id = analyticsSettings.ga4MeasurementId.trim().length > 0;
  const hasFacebookPixelId = analyticsSettings.facebookPixelId.trim().length > 0;

  const saveSettings = async (settingsToSave?: GHLSettings) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      await authenticatedRequest('PUT', '/api/integrations/ghl', token, settingsToSave || settings);
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/ghl'] });
      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Failed to save settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (checked: boolean) => {
    if (checked && ghlTestResult !== 'success') {
      toast({
        title: 'Please run Test Connection',
        description: 'You must have a successful test before enabling GoHighLevel.',
        variant: 'destructive'
      });
      return;
    }
    const newSettings = { ...settings, isEnabled: checked };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const testConnection = async () => {
    setIsTesting(true);
    setGhlTestResult('idle');
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Test failed', description: 'Authentication required', variant: 'destructive' });
        setIsTesting(false);
        return;
      }
      const response = await authenticatedRequest('POST', '/api/integrations/ghl/test', token, {
        apiKey: settings.apiKey,
        locationId: settings.locationId
      });
      const result = await response.json();

      if (result.success) {
        setGhlTestResult('success');
        await saveSettings(settings);
        toast({ title: 'Connection successful', description: 'Settings saved. You can now enable the integration.' });
      } else {
        setGhlTestResult('error');
        toast({
          title: 'Connection failed',
          description: result.message || 'Could not connect to GoHighLevel',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      setGhlTestResult('error');
      toast({
        title: 'Connection failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{integrationsMenuTitle}</h1>
        <p className="text-muted-foreground">Connect your booking system with external services</p>
      </div>

      <div className="space-y-4">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Assistant</CardTitle>
                  <p className="text-sm text-muted-foreground">Configure your AI-powered chat assistant</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs 
              value={activeTab} 
              onValueChange={(val) => {
                setActiveTab(val);
                saveChatSettings({ activeProvider: val });
              }}
              className="w-full"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-background p-1 mb-2">
                <TabsTrigger
                  value="openai"
                  className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <SiOpenai className="w-4 h-4" />
                    <span>OpenAI</span>
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      openAISettings.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {openAISettings.enabled ? "ON" : "OFF"}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="gemini"
                  className="flex items-center justify-between rounded-md px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    <span>Gemini</span>
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      geminiSettings.enabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {geminiSettings.enabled ? "ON" : "OFF"}
                  </span>
                </TabsTrigger>
              </TabsList>
              <p className="mb-6 text-xs text-muted-foreground">
                Active in chat now: <span className="font-medium text-foreground">{activeTab === 'gemini' ? 'Gemini' : 'OpenAI'}</span>
              </p>

              <TabsContent value="openai" className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable OpenAI</Label>
                    <p className="text-sm text-muted-foreground">Use ChatGPT models for responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSavingOpenAI && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={openAISettings.enabled}
                      onCheckedChange={handleToggleOpenAI}
                      disabled={isSavingOpenAI}
                      data-testid="switch-openai-enabled"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openai-api-key">API Key</Label>
                    <Input
                      id="openai-api-key"
                      type="password"
                      value={openAIApiKey || (openAISettings.hasKey ? '********' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '********' || (openAISettings.hasKey && val.length < 8 && !openAIApiKey)) {
                          setOpenAIApiKey('');
                        } else if (val !== '********') {
                          setOpenAIApiKey(val.replace(/^\*+/, ''));
                        }
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '********') {
                          setOpenAIApiKey('');
                        }
                      }}
                      placeholder="sk-..."
                      data-testid="input-openai-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored securely on the server. Not returned after saving.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openai-model">Model</Label>
                    <Select
                      value={openAISettings.model}
                      onValueChange={(val) => {
                        setOpenAISettings(prev => ({ ...prev, model: val }));
                        saveOpenAISettings({ model: val });
                      }}
                    >
                      <SelectTrigger id="openai-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-5">gpt-5</SelectItem>
                        <SelectItem value="gpt-5-mini">gpt-5-mini</SelectItem>
                        <SelectItem value="gpt-5-nano">gpt-5-nano</SelectItem>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                        <SelectItem value="gpt-4-turbo">gpt-4-turbo</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className={openAITestButtonClass}
                    onClick={testOpenAIConnection}
                    disabled={isTestingOpenAI || (!openAIApiKey && !openAISettings.hasKey)}
                    data-testid="button-test-openai"
                  >
                    {isTestingOpenAI && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {openAITestResult === 'success' ? 'Test OK' : openAITestResult === 'error' ? 'Test Failed' : 'Test Connection'}
                  </Button>
                </div>

                {openAITestMessage && (openAITestResult === 'error' || !openAISettings.enabled) && (
                  <div className={`p-3 rounded-lg text-sm ${openAITestResult === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {openAITestMessage}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gemini" className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Gemini</Label>
                    <p className="text-sm text-muted-foreground">Use Gemini models for responses</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSavingGemini && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={geminiSettings.enabled}
                      onCheckedChange={handleToggleGemini}
                      disabled={isSavingGemini}
                      data-testid="switch-gemini-enabled"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gemini-api-key">API Key</Label>
                    <Input
                      id="gemini-api-key"
                      type="password"
                      value={geminiApiKey || (geminiSettings.hasKey ? '********' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '********' || (geminiSettings.hasKey && val.length < 8 && !geminiApiKey)) {
                          setGeminiApiKey('');
                        } else if (val !== '********') {
                          setGeminiApiKey(val.replace(/^\*+/, ''));
                        }
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '********') {
                          setGeminiApiKey('');
                        }
                      }}
                      placeholder="AI..."
                      data-testid="input-gemini-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Stored securely on the server. Not returned after saving.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gemini-model">Model</Label>
                    <Select
                      value={geminiSettings.model}
                      onValueChange={(val) => {
                        setGeminiSettings(prev => ({ ...prev, model: val }));
                        saveGeminiSettings({ model: val });
                      }}
                    >
                      <SelectTrigger id="gemini-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                        <SelectItem value="gemini-3.0-flash">Gemini 3.0 Flash</SelectItem>
                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                        <SelectItem value="gemini-3.0-pro">Gemini 3.0 Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className={geminiTestButtonClass}
                    onClick={testGeminiConnection}
                    disabled={isTestingGemini || (!geminiApiKey && !geminiSettings.hasKey)}
                    data-testid="button-test-gemini"
                  >
                    {isTestingGemini && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {geminiTestResult === 'success' ? 'Test OK' : geminiTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
                  </Button>
                </div>

                {geminiTestMessage && (geminiTestResult === 'error' || !geminiSettings.enabled) && (
                  <div className={`p-3 rounded-lg text-sm ${geminiTestResult === 'success'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                    }`}>
                    {geminiTestMessage}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-0 bg-muted">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center overflow-hidden">
                  <img src={ghlLogo} alt="GoHighLevel" className="w-9 h-9 rounded-md object-contain" />
                </div>
                <div>
                  <CardTitle className="text-lg">GoHighLevel</CardTitle>
                  <p className="text-sm text-muted-foreground">Sync calendars, contacts, and appointments</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                <Label htmlFor="ghl-enabled" className="text-sm">
                  {settings.isEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="ghl-enabled"
                  checked={settings.isEnabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isSaving}
                  data-testid="switch-ghl-enabled"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ghl-api-key">API Key</Label>
                <Input
                  id="ghl-api-key"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your GoHighLevel API key"
                  data-testid="input-ghl-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your GHL account under Settings {'->'} Private Integrations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ghl-location-id">Location ID</Label>
                <Input
                  id="ghl-location-id"
                  value={settings.locationId}
                  onChange={(e) => setSettings(prev => ({ ...prev, locationId: e.target.value }))}
                  placeholder="Enter your Location ID"
                  data-testid="input-ghl-location-id"
                />
                <p className="text-xs text-muted-foreground">
                  Your GHL sub-account/location identifier
                </p>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ghl-calendar-id">Calendar ID</Label>
                <Input
                  id="ghl-calendar-id"
                  value={settings.calendarId}
                  onChange={(e) => setSettings(prev => ({ ...prev, calendarId: e.target.value }))}
                  placeholder="Enter your Calendar ID"
                  data-testid="input-ghl-calendar-id"
                />
                <p className="text-xs text-muted-foreground">ID of the GHL calendar to sync appointments with</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                className={ghlTestButtonClass}
                onClick={testConnection}
                disabled={isTesting || !settings.apiKey || !settings.locationId}
                data-testid="button-test-ghl"
              >
                {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {ghlTestResult === 'success' ? 'Test OK' : ghlTestResult === 'error' ? 'Test Failed' : 'Test Connection'}
              </Button>
            </div>

            {settings.isEnabled && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-sm">Integration Active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  New bookings will be synced to GoHighLevel automatically
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TwilioSection getAccessToken={getAccessToken} />

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <SiGoogletagmanager className="w-4 h-4 text-[#1A73E8] dark:text-[#8AB4F8]" />
                  </div>
                  <CardTitle className="text-base">Google Tag Manager</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.gtmEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('gtmEnabled', checked)}
                  data-testid="switch-gtm-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="gtm-id" className="text-sm">Container ID</Label>
                <Input
                  id="gtm-id"
                  value={analyticsSettings.gtmContainerId}
                  onChange={(e) => updateAnalyticsField('gtmContainerId', e.target.value)}
                  placeholder="GTM-XXXXXXX"
                  className="text-sm"
                  data-testid="input-gtm-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GTM under Admin {'->'} Container Settings
              </p>
              {analyticsSettings.gtmEnabled && hasGtmId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <SiGoogleanalytics className="w-4 h-4 text-[#E37400] dark:text-[#FFB74D]" />
                  </div>
                  <CardTitle className="text-base">Google Analytics 4</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.ga4Enabled}
                  onCheckedChange={(checked) => updateAnalyticsField('ga4Enabled', checked)}
                  data-testid="switch-ga4-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ga4-id" className="text-sm">Measurement ID</Label>
                <Input
                  id="ga4-id"
                  value={analyticsSettings.ga4MeasurementId}
                  onChange={(e) => updateAnalyticsField('ga4MeasurementId', e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="text-sm"
                  data-testid="input-ga4-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in GA4 Admin {'->'} Data Streams
              </p>
              {analyticsSettings.ga4Enabled && hasGa4Id && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 bg-muted">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <SiFacebook className="w-4 h-4 text-[#1877F2] dark:text-[#5AA2FF]" />
                  </div>
                  <CardTitle className="text-base">Facebook Pixel</CardTitle>
                </div>
                <Switch
                  checked={analyticsSettings.facebookPixelEnabled}
                  onCheckedChange={(checked) => updateAnalyticsField('facebookPixelEnabled', checked)}
                  data-testid="switch-fb-pixel-enabled"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="fb-pixel-id" className="text-sm">Pixel ID</Label>
                <Input
                  id="fb-pixel-id"
                  value={analyticsSettings.facebookPixelId}
                  onChange={(e) => updateAnalyticsField('facebookPixelId', e.target.value)}
                  placeholder="123456789012345"
                  className="text-sm"
                  data-testid="input-fb-pixel-id"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Find this in Meta Events Manager
              </p>
              {analyticsSettings.facebookPixelEnabled && hasFacebookPixelId && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  <span className="font-medium">Integration Active</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg space-y-4 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-primary" />
          Tracked Events
        </h2>
        <div className="p-4 bg-card/60 rounded-lg">
          <p className="text-xs text-muted-foreground mb-3">
            When enabled, the following events are automatically tracked:
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { event: 'cta_click', desc: 'Button clicks (Book Now, etc.)' },
              { event: 'add_to_cart', desc: 'Service added to cart' },
              { event: 'remove_from_cart', desc: 'Service removed from cart' },
              { event: 'begin_checkout', desc: 'Booking form started' },
              { event: 'purchase', desc: 'Booking confirmed (conversion)' },
              { event: 'view_item_list', desc: 'Services page viewed' },
            ].map(({ event, desc }) => (
              <div key={event} className="text-xs bg-muted/40 p-2 rounded">
                <code className="text-primary font-mono">{event}</code>
                <p className="text-muted-foreground mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BlogSection({ resetSignal, getAccessToken }: { resetSignal: number; getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'posts' | 'settings'>('posts');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'status'>('newest');
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [isRenamingTag, setIsRenamingTag] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isSeoChecklistOpen, setIsSeoChecklistOpen] = useState(false);
  const [isHtmlDialogOpen, setIsHtmlDialogOpen] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');
  const blogMenuTitle = menuItems.find((item) => item.id === 'blog')?.title ?? 'Blog Posts';
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    tags: '' as string,
    featureImageUrl: '',
    status: 'published',
    authorName: 'Skleanings',
    publishedAt: new Date().toISOString().split('T')[0] as string | null,
    serviceIds: [] as number[],
  });
  const [tagInput, setTagInput] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastContentRef = useRef('');
  const lastResetSignalRef = useRef(0);
  const linkRangeRef = useRef<Range | null>(null);
  const currentLinkRef = useRef<HTMLAnchorElement | null>(null);
  const seoFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSeoChecklistOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (seoFieldRef.current?.contains(target)) return;
      setIsSeoChecklistOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isSeoChecklistOpen]);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const sortedPosts = useMemo(() => {
    if (!posts) return [];

    const sorted = [...posts];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateA - dateB;
        });
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'status':
        return sorted.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'published' ? -1 : 1;
        });
      default:
        return sorted;
    }
  }, [posts, sortBy]);

  const availableTags = useMemo(() => {
    if (!posts) return [];
    const tagMap = new Map<string, string>();
    posts.forEach((post) => {
      const rawTags = (post.tags || '').split(',');
      rawTags.forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const selectedTagSet = useMemo(() => {
    return new Set(
      formData.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [formData.tags]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      const existing = prev.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: existing.length ? `${existing.join(',')},${trimmed}` : trimmed };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      metaDescription: '',
      focusKeyword: '',
      tags: '',
      featureImageUrl: '',
      status: 'published',
      authorName: 'Skleanings',
      publishedAt: new Date().toISOString().split('T')[0] as string | null,
      serviceIds: [],
    });
    setTagInput('');
  }, []);

  const handleBackToPosts = useCallback(() => {
    setIsCreateOpen(false);
    setEditingPost(null);
    setServiceSearch('');
    setIsSaved(false);
    resetForm();
  }, [resetForm]);

  // Reset saved state when form data changes
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formData]);

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    if (editingPost || isCreateOpen) {
      setIsCreateOpen(false);
      setEditingPost(null);
      setServiceSearch('');
      setIsSaved(false);
      resetForm();
    }
  }, [resetSignal, editingPost, isCreateOpen, resetForm]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (formData.content === lastContentRef.current) return;
    if (document.activeElement === contentRef.current) return;
    contentRef.current.innerHTML = formData.content;
    lastContentRef.current = formData.content;
  }, [formData.content]);

  const syncEditorContent = useCallback(() => {
    if (!contentRef.current) return;
    const rawHtml = contentRef.current.innerHTML;
    const text = contentRef.current.textContent?.trim() || '';
    const nextHtml = text ? rawHtml : '';
    lastContentRef.current = nextHtml;
    setFormData(prev => (prev.content === nextHtml ? prev : { ...prev, content: nextHtml }));
  }, []);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      if (!contentRef.current) return;
      contentRef.current.focus();
      document.execCommand(command, false, value);
      syncEditorContent();
    },
    [syncEditorContent]
  );

  const clearEditorFormatting = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const block = (range.startContainer as HTMLElement)?.parentElement?.closest('p,h1,h2,h3,h4,li,div');
      if (block) {
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        selection.removeAllRanges();
        selection.addRange(blockRange);
      }
    }
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    document.execCommand('formatBlock', false, '<p>');
    syncEditorContent();
  }, [syncEditorContent]);

  const setEditorBlock = useCallback(
    (tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4') => {
      runEditorCommand('formatBlock', `<${tag}>`);
    },
    [runEditorCommand]
  );

  const insertEditorLink = useCallback(() => {
    if (!contentRef.current) return;
    const selection = window.getSelection();
    const node = selection?.anchorNode || selection?.focusNode;
    const anchor = node ? (node.parentElement?.closest('a') ?? null) : null;
    if (anchor) {
      currentLinkRef.current = anchor;
      setLinkUrl(anchor.getAttribute('href') || '');
      setIsLinkDialogOpen(true);
      return;
    }
    if (selection && selection.rangeCount > 0) {
      linkRangeRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      linkRangeRef.current = null;
    }
    setLinkUrl('');
    setIsLinkDialogOpen(true);
  }, [runEditorCommand]);

  const handleInsertLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) {
      setIsLinkDialogOpen(false);
      return;
    }
    if (currentLinkRef.current) {
      currentLinkRef.current.setAttribute('href', url);
      syncEditorContent();
      setIsLinkDialogOpen(false);
      currentLinkRef.current = null;
      return;
    }
    const selection = window.getSelection();
    if (selection && linkRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(linkRangeRef.current);
    }
    if (!selection || selection.rangeCount === 0) {
      setIsLinkDialogOpen(false);
      return;
    }
    if (selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
    syncEditorContent();
    setIsLinkDialogOpen(false);
    linkRangeRef.current = null;
  }, [linkUrl, syncEditorContent]);

  const openHtmlEditor = useCallback(() => {
    if (contentRef.current) {
      setHtmlDraft(contentRef.current.innerHTML);
    } else {
      setHtmlDraft(formData.content || '');
    }
    setIsHtmlDialogOpen(true);
  }, [formData.content]);

  const applyHtmlEditor = useCallback(() => {
    const nextHtml = htmlDraft.trim();
    setFormData(prev => ({ ...prev, content: nextHtml }));
    if (contentRef.current) {
      contentRef.current.innerHTML = nextHtml;
      lastContentRef.current = nextHtml;
    }
    setIsHtmlDialogOpen(false);
  }, [htmlDraft]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('POST', '/api/blog', token, data);
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      const createdPost = response;
      toast({ title: 'Blog post created successfully' });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      // Update form to editing mode with the created post
      if (createdPost && createdPost.id) {
        setEditingPost(createdPost);
      }
    },
    onError: (err: any) => {
      toast({ title: 'Error creating post', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/blog/${id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error updating post', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/blog/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('DELETE', `/api/blog/tags/${encodeURIComponent(tag)}`, token);
    },
    onSuccess: (_data, tag) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag removed', description: `"${tag}" removed from all posts.` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsDeletingTag(false);
      setTagToDelete(null);
    }
  });

  const renameTagMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('PUT', `/api/blog/tags/${encodeURIComponent(from)}`, token, { name: to });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag updated', description: `"${variables.from}" renamed to "${variables.to}".` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsRenamingTag(false);
      setEditingTag(null);
      setEditingTagValue('');
    }
  });

  const handleConfirmRemoveTag = useCallback(() => {
    if (!tagToDelete || isDeletingTag) return;
    setIsDeletingTag(true);
    removeTagMutation.mutate(tagToDelete);
  }, [tagToDelete, isDeletingTag, removeTagMutation]);

  const handleStartEditTag = useCallback((tag: string) => {
    if (isRenamingTag) return;
    setEditingTag(tag);
    setEditingTagValue(tag);
  }, [isRenamingTag]);

  const handleCancelEditTag = useCallback(() => {
    setEditingTag(null);
    setEditingTagValue('');
  }, []);

  const handleSubmitEditTag = useCallback(() => {
    if (!editingTag || isRenamingTag) return;
    const next = editingTagValue.trim();
    if (!next) {
      handleCancelEditTag();
      return;
    }
    if (next === editingTag) {
      handleCancelEditTag();
      return;
    }
    const nextLower = next.toLowerCase();
    const currentLower = editingTag.toLowerCase();
    const hasDuplicate = availableTags.some(
      (tag) => tag.toLowerCase() === nextLower && tag.toLowerCase() !== currentLower
    );
    if (hasDuplicate) {
      toast({ title: 'Tag already exists', description: `"${next}" is already in use.` });
      return;
    }
    setIsRenamingTag(true);
    renameTagMutation.mutate({ from: editingTag, to: next });
  }, [editingTag, editingTagValue, isRenamingTag, availableTags, renameTagMutation, toast, handleCancelEditTag]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleEdit = async (post: BlogPost) => {
    const postServices = await fetch(`/api/blog/${post.id}/services`).then(r => r.json());
    setEditingPost(post);
    setIsSaved(false);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      tags: (post as any).tags || '',
      featureImageUrl: post.featureImageUrl || '',
      status: post.status,
      authorName: post.authorName || 'Admin',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : null,
      serviceIds: postServices.map((s: Service) => s.id),
    });
    setTagInput('');
  };

  const getPostSeoScore = useCallback((post: BlogPost) => {
    const keyword = (post.focusKeyword || '').toLowerCase().trim();
    if (!keyword) {
      return { score: null as number | null, badgeClass: 'bg-muted text-muted-foreground' };
    }

    const title = (post.title || '').toLowerCase();
    const slug = (post.slug || '').toLowerCase();
    const content = (post.content || '').toLowerCase();
    const metaDesc = (post.metaDescription || '').toLowerCase();

    let score = 0;
    if (title.includes(keyword)) score += 25;
    if (slug.includes(keyword.replace(/\s+/g, '-'))) score += 15;
    if (metaDesc.includes(keyword)) score += 25;

    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const keywordCount = (content.match(keywordRegex) || []).length;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    if (keywordCount >= 1) score += 10;
    if (keywordCount >= 3) score += 10;
    if (density >= 0.5 && density <= 2.5) score += 15;

    const badgeClass = score >= 80
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : score >= 50
        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
        : 'bg-red-500/15 text-red-600 dark:text-red-400';

    return { score, badgeClass };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast({ title: 'Content is required', variant: 'destructive' });
      return;
    }
    const dataToSend = {
      ...formData,
      publishedAt: formData.status === 'published' && formData.publishedAt
        ? new Date(formData.publishedAt).toISOString()
        : formData.status === 'published'
          ? new Date().toISOString()
          : null,
    };

    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Authentication required', variant: 'destructive' });
        return;
      }

      const uploadResponse = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadResponse.json();

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setFormData(prev => ({ ...prev, featureImageUrl: objectPath }));
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleServiceSelection = (serviceId: number) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : prev.serviceIds.length < 3
          ? [...prev.serviceIds, serviceId]
          : prev.serviceIds,
    }));
  };

  const renderForm = () => {
    const publishedDate = formData.publishedAt
      ? new Date(`${formData.publishedAt}T00:00:00`)
      : undefined;
    const focusScore = (() => {
      const keyword = formData.focusKeyword.toLowerCase().trim();
      if (!keyword) return null;

      const title = formData.title.toLowerCase();
      const slug = formData.slug.toLowerCase();
      const content = formData.content.toLowerCase();
      const metaDesc = formData.metaDescription.toLowerCase();

      let score = 0;
      const inTitle = title.includes(keyword);
      const inSlug = slug.includes(keyword.replace(/\s+/g, '-'));
      const inMeta = metaDesc.includes(keyword);
      if (inTitle) score += 25;
      if (inSlug) score += 15;
      if (inMeta) score += 25;

      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const keywordCount = (content.match(keywordRegex) || []).length;
      const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

      const hasOneUse = keywordCount >= 1;
      const hasThreeUses = keywordCount >= 3;
      const densityOk = density >= 0.5 && density <= 2.5;
      if (hasOneUse) score += 10;
      if (hasThreeUses) score += 10;
      if (densityOk) score += 15;

      const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
      const badgeClass = score >= 80
        ? 'bg-green-500/15 text-green-600 dark:text-green-400'
        : score >= 50
          ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
          : 'bg-red-500/15 text-red-600 dark:text-red-400';

      return {
        score,
        barColor,
        badgeClass,
        checks: {
          inTitle,
          inSlug,
          inMeta,
          hasOneUse,
          hasThreeUses,
          densityOk,
        },
        density,
        keywordCount,
      };
    })();

    const isPublished = formData.status === 'published';
    const saveLabel = isSaved
      ? 'Saved'
      : editingPost
        ? (isPublished ? 'Publish' : 'Update Post')
        : (isPublished ? 'Publish' : 'Create Post');

    const actionButtons = (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          type="submit"
          form="blog-post-form"
          disabled={createMutation.isPending || updateMutation.isPending}
          className={clsx(
            isSaved && 'bg-green-600 hover:bg-green-600 text-white'
          )}
          data-testid="button-blog-save"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {isSaved && <Check className="w-4 h-4 mr-2" />}
          {saveLabel}
        </Button>
        {editingPost && formData.slug && (
          <Button
            variant="outline"
            onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
            className="border-0"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Post
          </Button>
        )}
      </div>
    );

    return (
      <form id="blog-post-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-12">
          <div className="space-y-2 md:col-span-5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter post title"
              className="border-0 bg-background"
              required
              data-testid="input-blog-title"
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="url-friendly-slug"
              className="border-0 bg-background"
              required
              data-testid="input-blog-slug"
            />
          </div>
          <div className="space-y-1 md:col-span-4">
            <Label htmlFor="focusKeyword">Focus Keyword</Label>
            <div className="relative rounded-md bg-background overflow-visible" ref={seoFieldRef}>
              <div className="relative">
                <Input
                  id="focusKeyword"
                  value={formData.focusKeyword}
                  onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
                  placeholder="Primary SEO keyword"
                  className="pr-14 rounded-none border-0 bg-transparent"
                  data-testid="input-blog-keyword"
                  onFocus={() => setIsSeoChecklistOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsSeoChecklistOpen(false);
                  }}
                />
                {focusScore && (
                  <button
                    type="button"
                    className={clsx(
                      "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 items-center rounded-full px-2 text-[10px] font-medium leading-none",
                      focusScore.badgeClass
                    )}
                    aria-label="View SEO score checklist"
                    onClick={() => setIsSeoChecklistOpen(true)}
                  >
                    {focusScore.score}/100
                  </button>
                )}
              </div>
              {focusScore && (
                <div className="relative z-20 h-[3px] bg-slate-200 dark:bg-slate-700">
                  <div className={clsx("h-full transition-all", focusScore.barColor)} style={{ width: `${focusScore.score}%` }} />
                </div>
              )}
              {focusScore && isSeoChecklistOpen && (
                <div
                  className="absolute left-0 right-0 z-10 rounded-b-[4px] rounded-t-[0px] border-0 bg-popover p-3 shadow-lg"
                  style={{ top: 'calc(100% - 3px)' }}
                  role="dialog"
                  aria-label="SEO 100% checklist"
                >
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="text-sm font-semibold text-foreground">SEO 100% checklist</div>
                    <ul className="space-y-1">
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inTitle ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inTitle ? "text-foreground" : ""}>
                          Focus keyword in title
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inSlug ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inSlug ? "text-foreground" : ""}>
                          Focus keyword in slug
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inMeta ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inMeta ? "text-foreground" : ""}>
                          Focus keyword in meta description
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.hasOneUse ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.hasOneUse ? "text-foreground" : ""}>
                          Keyword appears at least once in content
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.hasThreeUses ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.hasThreeUses ? "text-foreground" : ""}>
                          Keyword appears 3+ times in content
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.densityOk ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.densityOk ? "text-foreground" : ""}>
                          Keyword density between 0.5% and 2.5%
                        </span>
                      </li>
                    </ul>
                    <div className="pt-1 text-[11px]">
                      Current: {focusScore.keywordCount} uses · {focusScore.density.toFixed(2)}% density
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="content">Content *</Label>
            <button
              type="button"
              onClick={() => setIsEditorExpanded(prev => !prev)}
              className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              {isEditorExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>

          <div className="rounded-md bg-background overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-2 py-2 text-[11px] text-muted-foreground sm:text-xs">
              {[
                { label: 'P', tag: 'p' },
                { label: 'H1', tag: 'h1' },
                { label: 'H2', tag: 'h2' },
                { label: 'H3', tag: 'h3' },
                { label: 'H4', tag: 'h4' },
              ].map(({ label, tag }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setEditorBlock(tag as 'p' | 'h1' | 'h2' | 'h3' | 'h4')}
                  className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border/60" />
              <button
                type="button"
                onClick={() => runEditorCommand('bold')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('italic')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('insertUnorderedList')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Bulleted list
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('insertOrderedList')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Numbered list
              </button>
              <button
                type="button"
                onClick={insertEditorLink}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Link
              </button>
              <button
                type="button"
                onClick={clearEditorFormatting}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={openHtmlEditor}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                HTML
              </button>
            </div>
            <div
              id="content"
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              onInput={syncEditorContent}
              onBlur={syncEditorContent}
              onPaste={(e) => {
                const htmlData = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');

                // If HTML is available, use it directly
                if (htmlData && htmlData.trim()) {
                  e.preventDefault();
                  // Clean up common formatting from external sources
                  let cleanHtml = htmlData
                    .replace(/<meta[^>]*>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\sclass="[^"]*"/gi, '')
                    .replace(/\sid="[^"]*"/gi, '')
                    .replace(/\sstyle="[^"]*"/gi, '');

                  document.execCommand('insertHTML', false, cleanHtml);
                  syncEditorContent();
                  return;
                }

                // Otherwise, detect if plain text looks like Markdown
                if (text && (
                  text.includes('# ') ||
                  text.includes('## ') ||
                  text.includes('**') ||
                  text.includes('* ') ||
                  text.match(/^\d+\. /m) ||
                  text.includes('[') && text.includes('](')
                )) {
                  e.preventDefault();
                  const html = markdownToHtml(text);
                  document.execCommand('insertHTML', false, html);
                  syncEditorContent();
                  return;
                }

                // If plain text looks like HTML, insert as HTML
                if (text && /<\/?[a-z][\s\S]*>/i.test(text)) {
                  e.preventDefault();
                  let cleanHtml = text
                    .replace(/<meta[^>]*>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    .replace(/<!--[\s\S]*?-->/g, '')
                    .replace(/\sclass="[^"]*"/gi, '')
                    .replace(/\sid="[^"]*"/gi, '')
                    .replace(/\sstyle="[^"]*"/gi, '');
                  document.execCommand('insertHTML', false, cleanHtml);
                  syncEditorContent();
                }
              }}
              data-placeholder="Write or paste your blog post content here..."
              className={clsx(
                "admin-editor px-3 py-2 text-sm focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-visible sm:overflow-y-auto",
                isEditorExpanded
                  ? "min-h-[260px] max-h-none sm:min-h-[420px] sm:max-h-[70vh]"
                  : "min-h-[150px] max-h-none sm:min-h-[220px] sm:max-h-[45vh]"
              )}
              data-testid="textarea-blog-content"
            />
          </div>
          <Dialog
            open={isLinkDialogOpen}
            onOpenChange={(open) => {
              setIsLinkDialogOpen(open);
              if (!open) {
                currentLinkRef.current = null;
                linkRangeRef.current = null;
              }
            }}
          >
            <DialogContent className="sm:max-w-sm border-0">
              <DialogHeader>
                <DialogTitle>Add link</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="border-0 bg-muted/40"
                  autoFocus
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (currentLinkRef.current) {
                      const link = currentLinkRef.current;
                      link.replaceWith(document.createTextNode(link.textContent || link.href));
                      syncEditorContent();
                    } else {
                      const selection = window.getSelection();
                      if (selection && linkRangeRef.current) {
                        selection.removeAllRanges();
                        selection.addRange(linkRangeRef.current);
                      }
                      runEditorCommand('unlink');
                    }
                    setIsLinkDialogOpen(false);
                    currentLinkRef.current = null;
                    linkRangeRef.current = null;
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleInsertLink}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isHtmlDialogOpen} onOpenChange={setIsHtmlDialogOpen}>
            <DialogContent className="sm:max-w-2xl border-0">
              <DialogHeader>
                <DialogTitle>Edit HTML</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="html-source">HTML</Label>
                <Textarea
                  id="html-source"
                  value={htmlDraft}
                  onChange={(e) => setHtmlDraft(e.target.value)}
                  className="min-h-[240px] font-mono text-xs border-0 bg-muted/40"
                  placeholder="<h2>Title</h2>"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={applyHtmlEditor}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-xs text-muted-foreground">
            Paste HTML or Markdown — auto-converts and formats!
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={formData.metaDescription}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                metaDescription: e.target.value.slice(0, 155)
              }))}
              placeholder="Short description for SEO and blog cards..."
              className="min-h-[100px] border-0 bg-background"
              data-testid="textarea-blog-meta"
            />
            <p className="text-xs text-muted-foreground">{formData.metaDescription.length}/155 characters · Used for SEO and blog cards</p>
          </div>
          <div className="space-y-2">
            <Label>Feature Image</Label>
            <div
              className="relative w-full sm:w-1/2 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group"
              onClick={() => document.getElementById('featureImageInput')?.click()}
            >
              {formData.featureImageUrl ? (
                <>
                  <img
                    src={formData.featureImageUrl}
                    alt="Feature"
                    className="w-full h-full object-cover"
                    data-testid="img-blog-feature-preview"
                  />
                  <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    Uploaded
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Click to change</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, featureImageUrl: '' }));
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                  <Image className="w-8 h-8 mb-2" />
                  <span className="text-sm">Click to upload</span>
                  <span className="text-xs mt-1">1200x675px (16:9)</span>
                </div>
              )}
              <input
                id="featureImageInput"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-blog-feature-image"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 min-h-9 rounded-md bg-background px-3 py-2">
              {formData.tags.split(',').filter(t => t.trim()).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
                >
                  {tag.trim()}
                  <button
                    type="button"
                    onClick={() => {
                      const tags = formData.tags.split(',').filter(t => t.trim());
                      tags.splice(index, 1);
                      setFormData(prev => ({ ...prev, tags: tags.join(',') }));
                    }}
                    className="hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const newTag = tagInput.trim();
                    if (newTag && !formData.tags.split(',').map(t => t.trim().toLowerCase()).includes(newTag.toLowerCase())) {
                      setFormData(prev => ({
                        ...prev,
                        tags: prev.tags ? `${prev.tags},${newTag}` : newTag
                      }));
                    }
                    setTagInput('');
                  }
                }}
                placeholder={formData.tags ? "Add more..." : "Type and press Enter..."}
                className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Available tags</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags
                    .filter((tag) => !selectedTagSet.has(tag.toLowerCase()))
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Related Services (max 3)</Label>
            <div className="rounded-md bg-background overflow-hidden">
              <Input
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="rounded-none border-0 bg-transparent"
                data-testid="input-service-search"
              />
              <div className="grid gap-2 max-h-[120px] overflow-y-auto border-t border-border/50 p-3">
                {services?.filter(s =>
                  !s.isHidden &&
                  s.name.toLowerCase().includes(serviceSearch.toLowerCase())
                ).map(service => (
                  <div
                    key={service.id}
                    className="flex items-center gap-2"
                  >
                    <Checkbox
                      id={`service-${service.id}`}
                      checked={formData.serviceIds.includes(service.id)}
                      onCheckedChange={() => toggleServiceSelection(service.id)}
                      disabled={!formData.serviceIds.includes(service.id) && formData.serviceIds.length >= 3}
                      data-testid={`checkbox-service-${service.id}`}
                    />
                    <Label htmlFor={`service-${service.id}`} className="text-sm cursor-pointer">
                      {service.name} - ${service.price}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="border-0 bg-background" data-testid="select-blog-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="publishedAt">Publication Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  id="publishedAt"
                  type="button"
                  className={clsx(
                    "flex h-9 w-full items-center justify-between rounded-md bg-background px-3 py-2 text-sm",
                    !publishedDate && "text-muted-foreground"
                  )}
                  data-testid="input-blog-date"
                >
                  <span className="truncate">
                    {publishedDate ? format(publishedDate, "MM/dd/yyyy") : "Select date"}
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto rounded-2xl border-0 p-0 shadow-lg overflow-hidden"
                align="end"
                side="bottom"
                sideOffset={8}
              >
                <CalendarPicker
                  mode="single"
                  selected={publishedDate}
                  onSelect={(date) =>
                    setFormData(prev => ({
                      ...prev,
                      publishedAt: date ? format(date, "yyyy-MM-dd") : null
                    }))
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorName">Author</Label>
            <Input
              id="authorName"
              value={formData.authorName}
              onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
              placeholder="Skleanings"
              className="border-0 bg-background"
              data-testid="input-blog-author"
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 pt-4 border-t border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBackToPosts}
            data-testid="button-blog-back-bottom"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Posts
          </Button>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:gap-3">
            {actionButtons}
          </div>
        </div>
      </form>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCreateOpen || editingPost) {
    const saveLabel = isSaved ? 'Saved' : editingPost ? 'Update Post' : 'Create Post';
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToPosts}
              data-testid="button-blog-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Posts
            </Button>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:gap-3">
            <Button
              type="submit"
              form="blog-post-form"
              size="sm"
              disabled={createMutation.isPending || updateMutation.isPending}
              className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
              data-testid="button-blog-save-top"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSaved && <Check className="w-4 h-4 mr-2" />}
              {saveLabel}
            </Button>
            {editingPost && formData.slug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
                className="border-0"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Post
              </Button>
            )}
          </div>
        </div>
        <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
          {renderForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-blog-title">{blogMenuTitle}</h1>
          <p className="text-sm text-muted-foreground">Manage your blog content and SEO</p>
        </div>
        <div className="flex bg-muted rounded-lg p-1 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === 'posts'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Posts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === 'settings'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'posts' ? (
        <div className="space-y-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-none">
              <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full sm:w-auto justify-start px-2 -ml-2 text-muted-foreground hover:text-foreground">
                    <Tag className="w-4 h-4 mr-2" />
                    Manage Tags
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md border-0">
                  <DialogHeader>
                    <DialogTitle>Manage Tags</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {availableTags.length > 0 ? (
                      availableTags.map((tag) => (
                        <div
                          key={tag}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
                          onDoubleClick={() => handleStartEditTag(tag)}
                        >
                          {editingTag === tag ? (
                            <Input
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSubmitEditTag();
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelEditTag();
                                }
                              }}
                              onBlur={handleSubmitEditTag}
                              autoFocus
                              className="h-8 border-0 bg-transparent px-0 text-sm"
                              data-testid={`input-tag-edit-${tag}`}
                            />
                          ) : (
                            <span className="text-sm font-medium">{tag}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditTag(tag)}
                              disabled={isDeletingTag || isRenamingTag}
                              data-testid={`button-tag-edit-${tag}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setTagToDelete(tag)}
                              disabled={isDeletingTag || editingTag === tag || isRenamingTag}
                              data-testid={`button-tag-delete-${tag}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tags available.</p>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-blog-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto" onClick={(e) => {
                e.preventDefault();
                setIsCreateOpen(true);
              }} data-testid="button-blog-create">
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </div>
          </div>

          <div className="bg-muted p-3 sm:p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Posts
            </h2>
            {sortedPosts && sortedPosts.length > 0 ? (
              <div className="space-y-3">
                {sortedPosts.map(post => {
                  const seoScore = getPostSeoScore(post);
                  return (
                    <div key={post.id} className="flex flex-col gap-3 p-3 bg-card/90 dark:bg-slate-900/70 rounded-lg overflow-hidden border border-transparent hover:border-border/50 transition-all shadow-sm" data-testid={`row-blog-${post.id}`}>
                      {/* Top Row: Image + Title + Date */}
                      <div className="flex items-start gap-3">
                        {post.featureImageUrl ? (
                          <img
                            src={post.featureImageUrl}
                            alt={post.title}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity shrink-0 bg-muted"
                            onClick={() => handleEdit(post)}
                            data-testid={`img-blog-${post.id}`}
                          />
                        ) : (
                          <div
                            className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors shrink-0"
                            onClick={() => handleEdit(post)}
                          >
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/50" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-16 sm:h-20 py-0.5">
                          <div>
                            <h3
                              className="font-medium text-sm sm:text-base line-clamp-2 leading-tight cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleEdit(post)}
                              data-testid={`text-blog-title-${post.id}`}
                            >
                              {post.title}
                            </h3>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy') : 'Not published'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Badges and Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                          <div
                            className={clsx(
                              "flex items-center h-6 rounded-full px-2 text-[10px] sm:text-[11px] font-medium shrink-0",
                              seoScore.badgeClass
                            )}
                            data-testid={`badge-blog-seo-${post.id}`}
                          >
                            SEO {seoScore.score === null ? '—' : `${seoScore.score}`}
                          </div>
                          <Badge
                            variant={post.status === 'published' ? 'default' : 'secondary'}
                            className="h-6 rounded-full px-2 text-[10px] sm:text-[11px] leading-none flex items-center shrink-0"
                            data-testid={`badge-blog-status-${post.id}`}
                          >
                            {post.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(post)}
                            data-testid={`button-blog-edit-${post.id}`}
                            className="h-8 w-8 hover:bg-muted"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-blog-delete-${post.id}`} className="h-8 w-8 hover:bg-muted">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{post.title}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(post.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No blog posts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first blog post to engage your audience
                </p>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-first-post">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <BlogSettings />
      )}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDelete
                ? `Remove "${tagToDelete}" from all posts? This cannot be undone.`
                : 'Remove this tag from all posts?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTag}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveTag} disabled={isDeletingTag}>
              {isDeletingTag ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
