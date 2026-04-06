import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAdminAuth } from '@/context/AuthContext';
import { useCompanySettings } from '@/context/CompanySettingsContext';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { ProfileSection } from '@/components/account/ProfileSection';
import { BookingsSection } from '@/components/account/BookingsSection';

export default function AccountShell() {
  const { role, isClient, loading, signOut } = useAdminAuth();
  const { settings: companySettings } = useCompanySettings();
  const [location, setLocation] = useLocation();

  // Auth guard — redirect based on role
  useEffect(() => {
    if (loading) return;
    if (!role) {
      setLocation('/account/login');
    } else if (role !== 'client') {
      setLocation('/admin');
    }
  }, [role, loading, setLocation]);

  // Redirect unknown /account/* paths to /account
  const isProfileActive = location === '/account';
  const isBookingsActive = location.startsWith('/account/bookings');

  useEffect(() => {
    if (!loading && isClient && !isProfileActive && !isBookingsActive) {
      setLocation('/account');
    }
  }, [loading, isClient, isProfileActive, isBookingsActive, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isClient) {
    return null;
  }

  const handleLogout = async () => {
    await signOut();
    setLocation('/account/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          {companySettings?.companyName || 'My Account'}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </header>

      {/* Tab navigation */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-6 flex">
          <button
            onClick={() => setLocation('/account')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              isProfileActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setLocation('/account/bookings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              isBookingsActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            My Bookings
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-6">
        {isBookingsActive ? <BookingsSection /> : <ProfileSection />}
      </main>
    </div>
  );
}
