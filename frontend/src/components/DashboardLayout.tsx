import React, { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { NotificationPopup } from './NotificationPopup.js';
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
  ShoppingBag
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, logout, activeBranchId, setActiveBranchId, branches } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { name: 'My Portal', path: '/portal', icon: LayoutDashboard, roles: ['MEMBER'] },
  ];

  const filteredNavigation = navigationItems.filter(
    item => user && item.roles.includes(user.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
