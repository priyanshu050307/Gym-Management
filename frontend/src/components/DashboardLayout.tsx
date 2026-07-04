import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { NotificationPopup } from './NotificationPopup.js';
import { apiFetch } from '../utils/api.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  QrCode,
  Calendar,
  LogOut,
  Menu,
  X,
  Dumbbell,
  User as UserIcon,
  MapPin,
  ShoppingBag,
  Sparkles,
  Clock,
  Lock
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout, activeBranchId, setActiveBranchId, branches } = useAuth();
  const { notifications, dismissNotification } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // SaaS states
  const [saasSub, setSaasSub] = useState<any>(null);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);

  const fetchSaaSStatus = async () => {
    try {
      const data = await apiFetch<{ subscription: any }>('/saas/status');
      setSaasSub(data.subscription);
      
      // Show welcome modal if new trial is active and not shown yet
      if (
        data.subscription.status === 'TRIAL_ACTIVE' &&
        !localStorage.getItem('gymos_welcome_shown') &&
        user?.role === 'ADMIN'
      ) {
        setWelcomeModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to load SaaS subscription:', err);
    }
  };

  useEffect(() => {
    fetchSaaSStatus();
  }, [location.pathname]); // Refetch on navigation to stay updated

  const handleDismissWelcome = () => {
    localStorage.setItem('gymos_welcome_shown', 'true');
    setWelcomeModalOpen(false);
  };

  const navigationItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'] },
    { name: 'My Dashboard', path: '/trainer-portal', icon: LayoutDashboard, roles: ['TRAINER'] },
    { name: 'Members', path: '/members', icon: Users, roles: ['ADMIN', 'STAFF', 'TRAINER'] },
    { name: 'Membership Plans', path: '/plans', icon: FileText, roles: ['ADMIN', 'STAFF'] },
    { name: 'Billing & Payments', path: '/billing', icon: CreditCard, roles: ['ADMIN', 'STAFF'] },
    { name: 'Check-In Kiosk', path: '/kiosk', icon: QrCode, roles: ['ADMIN', 'STAFF'] },
    { name: 'Classes & Bookings', path: '/schedules', icon: Calendar, roles: ['ADMIN', 'STAFF', 'TRAINER'] },
    { name: 'Equipment', path: '/equipment', icon: Dumbbell, roles: ['ADMIN', 'STAFF'] },
    { name: 'Supplements Inventory', path: '/supplements', icon: ShoppingBag, roles: ['ADMIN', 'STAFF'] },
    { name: 'Branches', path: '/branches', icon: MapPin, roles: ['ADMIN'] },
    { name: 'SaaS Subscription', path: '/subscription', icon: Sparkles, roles: ['ADMIN'] },
    { name: 'My Portal', path: '/portal', icon: LayoutDashboard, roles: ['MEMBER'] },
  ];

  const filteredNavigation = navigationItems.filter(
    item => user && item.roles.includes(user.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const daysRemaining = saasSub
    ? Math.max(0, Math.ceil((new Date(saasSub.trialEndDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))
    : 0;

  const isLocked = saasSub && (saasSub.status === 'TRIAL_EXPIRED' || saasSub.status === 'SUBSCRIBED_EXPIRED');
  const isBillingPage = location.pathname === '/subscription';

  useEffect(() => {
    if (isLocked) {
      navigate('/', { state: { fromExpired: true } });
    }
  }, [isLocked]);

  return (
    <div className="min-h-screen bg-gym-darker flex">
      <NotificationPopup />
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col glass-card border-r border-slate-100 h-screen sticky top-0">
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-100">
          <Dumbbell className="h-8 w-8 text-gym-primary" />
          <span className="text-xl font-bold tracking-wider bg-gradient-premium bg-clip-text text-transparent">
            GYMNASIUM
          </span>
        </div>

        {branches.length > 0 && user?.role === 'ADMIN' && (
          <div className="px-6 py-4 border-b border-slate-100">
            <label className="block text-[10px] font-semibold text-gym-muted uppercase tracking-wider mb-1">
              Active Branch
            </label>
            <select
              value={activeBranchId || ''}
              onChange={(e) => setActiveBranchId(e.target.value || null)}
              className="w-full bg-slate-900 border border-slate-800 text-gym-text text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gym-primary cursor-pointer"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gym-primary/20 text-gym-primary border-l-4 border-gym-primary font-medium'
                    : 'text-gym-muted hover:bg-slate-50 hover:text-gym-text'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-gym-primary' : 'text-gym-muted group-hover:text-gym-text'
                }`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="h-9 w-9 rounded-full bg-gym-primary/20 flex items-center justify-center border border-gym-primary/30">
              <UserIcon className="h-5 w-5 text-gym-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gym-muted truncate uppercase tracking-wider">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-6 h-20 glass-nav z-20">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-7 w-7 text-gym-primary" />
            <span className="text-lg font-bold tracking-wider bg-gradient-premium bg-clip-text text-transparent">
              GYMNASIUM
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gym-text hover:text-gym-primary transition-colors duration-200"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-20 z-10 glass-card bg-white/95 flex flex-col">
            {branches.length > 0 && user?.role === 'ADMIN' && (
              <div className="px-6 pt-6 pb-2 border-b border-slate-100">
                <label className="block text-[10px] font-semibold text-gym-muted uppercase tracking-wider mb-1">
                  Active Branch
                </label>
                <select
                  value={activeBranchId || ''}
                  onChange={(e) => setActiveBranchId(e.target.value || null)}
                  className="w-full bg-slate-900 border border-slate-800 text-gym-text text-sm rounded-lg px-2.5 py-2.5 focus:outline-none focus:border-gym-primary cursor-pointer text-white"
                >
                  <option value="">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <nav className="flex-1 px-6 py-8 space-y-2 overflow-y-auto">
              {filteredNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-xl transition-all ${
                      isActive
                        ? 'bg-gym-primary/20 text-gym-primary border-l-4 border-gym-primary font-medium'
                        : 'text-gym-muted hover:bg-slate-50 hover:text-gym-text'
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-base">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-3 px-4">
                <div className="h-10 w-10 rounded-full bg-gym-primary/20 flex items-center justify-center border border-gym-primary/30">
                  <UserIcon className="h-6 w-6 text-gym-primary" />
                </div>
                <div>
                  <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gym-muted uppercase tracking-wider">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-4 px-4 py-4 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut className="h-6 w-6" />
                <span className="text-base">Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Trial Banner */}
          {saasSub && saasSub.status === 'TRIAL_ACTIVE' && (
            <div className={`w-full py-3 px-6 text-center text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              daysRemaining <= 2
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/10'
                : daysRemaining <= 7
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                : 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
            }`}>
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                {daysRemaining <= 2
                  ? `🔴 Trial Action Required — ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'} Remaining`
                  : daysRemaining <= 7
                  ? `🟠 Trial Expiring Soon — ${daysRemaining} Days Remaining`
                  : `🟢 Trial Active — ${daysRemaining} Days Remaining`
                }
              </span>
              <button
                onClick={() => navigate('/subscription')}
                className={`ml-3 px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all hover:scale-105 ${
                  daysRemaining <= 2
                    ? 'bg-white text-red-600 hover:bg-slate-100'
                    : 'bg-black text-white hover:bg-slate-900'
                }`}
              >
                Upgrade Now
              </button>
            </div>
          )}

          <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Welcome Modal */}
      {welcomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-slate-100/10 space-y-6 text-center animate-fade-in bg-slate-900">
            <div className="h-16 w-16 bg-gym-primary/10 rounded-2xl flex items-center justify-center text-gym-primary border border-gym-primary/20 mx-auto">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gym-text">Welcome to GymOS!</h3>
              <p className="text-sm text-gym-muted">
                Your 30-day free trial has officially started. Experience fitness management built for modern scale.
              </p>
            </div>

            <div className="bg-slate-950/40 p-4.5 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Remaining Access</span>
              <h4 className="text-2xl font-extrabold text-gym-primary">{daysRemaining} Days Left</h4>
            </div>

            <button
              onClick={handleDismissWelcome}
              className="w-full py-3.5 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl shadow-lg shadow-gym-primary/20 transition-all text-sm"
            >
              Start Exploring
            </button>
          </div>
        </div>
      )}

      {/* Expiry lock overlay */}
      {isLocked && !isBillingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gym-darker/70 backdrop-blur-md p-4">
          <div className="glass-card max-w-lg w-full p-8 rounded-3xl border border-red-500/20 space-y-6 text-center shadow-2xl shadow-red-500/5 bg-slate-900">
            <div className="h-16 w-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/20 mx-auto">
              <Lock className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-gym-text">Your GymOS Trial Has Ended</h3>
              <p className="text-sm text-gym-muted">
                All your gym branches, trainer data, check-ins, and configurations are securely saved. Choose a subscription to resume business operations.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate('/subscription')}
                className="flex-1 py-3.5 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl shadow-lg shadow-gym-primary/10 transition-all text-sm flex items-center justify-center gap-2"
              >
                View Plans
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-gym-text border border-slate-800 font-bold rounded-xl transition-all text-sm text-white"
              >
                Logout
              </button>
            </div>
            <a href="mailto:support@gymos.com" className="text-xs text-gym-muted hover:text-gym-primary transition-colors block">
              Contact Support & Sales
            </a>
          </div>
        </div>
      )}

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4.5 rounded-2xl shadow-2xl flex gap-3 items-start animate-in slide-in-from-bottom duration-300 relative overflow-hidden"
          >
            {/* Left Accent indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
              n.type === 'checkin' ? 'bg-green-500' :
              n.type === 'payment' ? 'bg-amber-500' :
              n.type === 'member' ? 'bg-blue-500' : 'bg-purple-500'
            }`} />
            
            <div className="flex-1 pl-1">
              <h4 className="text-xs font-bold text-white tracking-wide uppercase">{n.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>
            </div>
            
            <button
              onClick={() => dismissNotification(n.id)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
