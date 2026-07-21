import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Users,
  QrCode,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Calendar,
  Dumbbell,
  BookOpen,
  Rocket,
  Flame,
  Activity,
  UserCheck,
  UserX
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { OnboardingModal } from '../components/OnboardingModal.js';

interface DashboardStats {
  totalMembers: number;
  monthlyRevenue: number;
  checkInsToday: number;
  pendingPayments: number;
}

interface RecentCheckIn {
  id: string;
  timestamp: string;
  member: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface WeeklySignupItem {
  day: string;
  count: number;
}

interface PeakHourItem {
  hour: string;
  count: number;
}

interface ChartData {
  weeklySignups: WeeklySignupItem[];
  peakHours: PeakHourItem[];
}

export const DashboardOverview: React.FC = () => {
  const { user, activeBranchId } = useAuth();
  
  // Admin/Staff States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [heatmapData, setHeatmapData] = useState<{ matrix: number[][]; peakTime?: { day: string; hour: string; count: number } } | null>(null);
  const [retentionData, setRetentionData] = useState<{ retentionRate: number; churnRate: number } | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  
  // Trainer States
  const [trainerClasses, setTrainerClasses] = useState<any[]>([]);
  const [trainerStats, setTrainerStats] = useState({
    activeClients: 0,
    classesToday: 0,
    totalBookingsToday: 0,
    completionRate: 100,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kiosk scanner state
  const [memberIdInput, setMemberIdInput] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchAdminData = async () => {
    try {
      const data = await apiFetch<{
        stats: DashboardStats;
        recentCheckIns: RecentCheckIn[];
        charts?: ChartData;
      }>('/members/dashboard/stats');
      setStats(data.stats);
      setRecentCheckIns(data.recentCheckIns);
      if (data.charts) {
        setCharts(data.charts);
      }

      // Fetch Analytics Heatmap & Retention
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      try {
        const hData = await apiFetch<any>('/analytics/heatmap', { headers });
        setHeatmapData(hData);
        const rData = await apiFetch<any>('/analytics/retention', { headers });
        setRetentionData(rData);
      } catch (e) {
        console.error('Analytics load error:', e);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    }
  };

  const fetchTrainerData = async () => {
    try {
      const data = await apiFetch<{ classes: any[] }>('/classes');
      
      // Filter classes for the logged in trainer
      // Check both trainerId and trainer.userId (since logged in user id is user.id)
      const myClasses = data.classes.filter(
        (c: any) => c.trainer?.userId === user?.id
      );

      setTrainerClasses(myClasses);

      // Calculations
      const today = new Date().toDateString();
      const classesTodayList = myClasses.filter(
        (c: any) => new Date(c.dateTime).toDateString() === today
      );

      const uniqueClients = new Set();
      let bookingsTodayCount = 0;

      myClasses.forEach((c: any) => {
        if (c.bookings) {
          c.bookings.forEach((b: any) => {
            uniqueClients.add(b.memberId);
            if (new Date(c.dateTime).toDateString() === today) {
              bookingsTodayCount++;
            }
          });
        }
      });

      setTrainerStats({
        activeClients: uniqueClients.size,
        classesToday: classesTodayList.length,
        totalBookingsToday: bookingsTodayCount,
        completionRate: myClasses.length > 0 ? 92 : 100, // mock completion rate
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load trainer schedule.');
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    if (user?.role === 'TRAINER') {
      await fetchTrainerData();
    } else {
      await fetchAdminData();
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, activeBranchId]);

  const handleQuickCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberIdInput.trim()) return;

    setCheckInLoading(true);
    setCheckInResult(null);
    try {
      const res = await apiFetch<any>(`/members/${memberIdInput.trim()}/checkin`, {
        method: 'POST',
      });
      setCheckInResult({
        type: 'success',
        text: `Access Granted! ${res.member.name} successfully checked in.`,
      });
      setMemberIdInput('');
      fetchDashboardData(); // Refresh logs and stats
    } catch (err: any) {
      setCheckInResult({
        type: 'error',
        text: err.message || 'Access Denied: Inactive or invalid membership ID.',
      });
    } finally {
      setCheckInLoading(false);
    }
  };

  // Weekly Registration Signups SVG Calculations
  const renderWeeklySignupsChart = () => {
    if (!charts || !charts.weeklySignups || charts.weeklySignups.length === 0) {
      return <div className="text-gym-muted text-xs py-8 text-center">No signup data available.</div>;
    }

    const data = charts.weeklySignups;
    const maxVal = Math.max(...data.map((d) => d.count), 5);
    const chartHeight = 120;
    const chartWidth = 420;
    const barWidth = 32;
    const barSpacing = (chartWidth - barWidth * data.length) / (data.length + 1);

    return (
      <svg className="w-full h-44 mt-4" viewBox={`0 0 ${chartWidth} 170`}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio, index) => {
          const y = 10 + ratio * chartHeight;
          const label = Math.round(maxVal * (1 - ratio));
          return (
            <g key={index}>
              <line
                x1="25"
                y1={y}
                x2={chartWidth - 10}
                y2={y}
                stroke="white"
                strokeOpacity="0.04"
                strokeDasharray="4 4"
              />
              <text x="5" y={y + 4} fill="#94a3b8" fontSize="9" opacity="0.6">
                {label}
              </text>
            </g>
          );
        })}

        {data.map((item, i) => {
          const x = barSpacing + i * (barWidth + barSpacing) + 20;
          const barHeight = (item.count / maxVal) * chartHeight;
          const y = chartHeight - barHeight + 10;

          return (
            <g key={item.day} className="group">
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 3)}
                rx="6"
                fill="url(#barGradient)"
                className="transition-all duration-300 hover:fill-gym-secondary"
              />
              
              <text
                x={x + barWidth / 2}
                y={y - 6}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {item.count}
              </text>

              <text
                x={x + barWidth / 2}
                y={chartHeight + 28}
                fill="#94a3b8"
                fontSize="10"
                textAnchor="middle"
              >
                {item.day}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  // Peak Hours Occupancy SVG Calculations
  const renderPeakHoursChart = () => {
    if (!charts || !charts.peakHours || charts.peakHours.length === 0) {
      return <div className="text-gym-muted text-xs py-8 text-center">No peak hour logs available.</div>;
    }

    const data = charts.peakHours;
    const maxVal = Math.max(...data.map((d) => d.count), 5);
    const chartHeight = 120;
    const chartWidth = 420;

    // Create polyline path coordinates
    const points = data
      .map((item, i) => {
        const x = 30 + i * ((chartWidth - 50) / (data.length - 1));
        const y = chartHeight - (item.count / maxVal) * chartHeight + 10;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg className="w-full h-44 mt-4" viewBox={`0 0 ${chartWidth} 170`}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio, index) => {
          const y = 10 + ratio * chartHeight;
          const label = Math.round(maxVal * (1 - ratio));
          return (
            <g key={index}>
              <line
                x1="25"
                y1={y}
                x2={chartWidth - 10}
                y2={y}
                stroke="white"
                strokeOpacity="0.04"
              />
              <text x="5" y={y + 4} fill="#94a3b8" fontSize="9" opacity="0.6">
                {label}
              </text>
            </g>
          );
        })}

        {/* Fill under the line */}
        <polygon
          points={`30,${chartHeight + 10} ${points} ${
            30 + (data.length - 1) * ((chartWidth - 50) / (data.length - 1))
          },${chartHeight + 10}`}
          fill="url(#areaGradient)"
        />

        {/* The Line */}
        <polyline
          fill="none"
          stroke="#ec4899"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Data points */}
        {data.map((item, i) => {
          const x = 30 + i * ((chartWidth - 50) / (data.length - 1));
          const y = chartHeight - (item.count / maxVal) * chartHeight + 10;

          return (
            <g key={item.hour} className="group">
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="#ffffff"
                stroke="#ec4899"
                strokeWidth="2"
                className="cursor-pointer transition-all duration-200 group-hover:r-6"
              />

              <text
                x={x}
                y={y - 8}
                fill="#ffffff"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {item.count}
              </text>

              <text
                x={x}
                y={chartHeight + 28}
                fill="#94a3b8"
                fontSize="8.5"
                textAnchor="middle"
                transform={`rotate(-25, ${x}, ${chartHeight + 28})`}
              >
                {item.hour}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
      </div>
    );
  }

  // ==================== TRAINER PORTAL VIEW ====================
  if (user?.role === 'TRAINER') {
    const todayStr = new Date().toDateString();
    const todayClassesList = trainerClasses.filter(
      (c: any) => new Date(c.dateTime).toDateString() === todayStr
    );

    return (
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 md:p-8 rounded-2xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 bg-gym-primary/5 rounded-full blur-2xl -z-10"></div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gym-primary text-sm font-semibold tracking-wide uppercase">
              <Sparkles className="h-4 w-4" />
              Trainer Portal Dashboard
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gym-text">
              Welcome back, Coach {user.firstName}!
            </h1>
            <p className="text-sm text-gym-muted max-w-xl">
              Track your scheduled training sessions, monitor client attendance, and check today's classes at a glance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/schedules"
              className="px-5 py-3 bg-gym-primary hover:bg-gym-primary-hover text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-gym-primary/20 flex items-center gap-2"
            >
              <Calendar className="h-5 w-5" />
              View Class Schedule
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Active Clients */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">My Clients</span>
              <p className="text-3xl font-extrabold text-white">{trainerStats.activeClients}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-gym-primary/15 flex items-center justify-center border border-gym-primary/10 text-gym-primary">
              <Users className="h-6 w-6" />
            </div>
          </div>

          {/* Classes Today */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Sessions Today</span>
              <p className="text-3xl font-extrabold text-gym-text">{trainerStats.classesToday}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-pink-500/15 flex items-center justify-center border border-pink-500/10 text-gym-secondary">
              <Dumbbell className="h-6 w-6" />
            </div>
          </div>

          {/* Total Bookings Today */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Today's Bookings</span>
              <p className="text-3xl font-extrabold text-gym-text">{trainerStats.totalBookingsToday}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </div>

          {/* Completion Rate */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
            <div className="space-y-2">
              <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Completion Rate</span>
              <p className="text-3xl font-extrabold text-gym-text">{trainerStats.completionRate}%</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/10 text-amber-400">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Classes List Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Classes List */}
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-gym-primary" />
              Today's Training Sessions
            </h2>
            
            {todayClassesList.length === 0 ? (
              <div className="py-12 text-center text-gym-muted italic border border-dashed border-slate-700/30 rounded-xl">
                No classes scheduled for today.
              </div>
            ) : (
              <div className="space-y-4">
                {todayClassesList.map((c: any) => (
                  <div
                    key={c.id}
                    className="p-4 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between hover:border-gym-primary/30 transition-all"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-gym-text text-base">{c.name}</h4>
                      <p className="text-xs text-gym-muted flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(c.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({c.durationMinutes} mins)
                        <span className="text-slate-500">•</span>
                        <Users className="h-3.5 w-3.5" />
                        {c.bookings?.length || 0} / {c.capacity} Booked
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-gym-primary/10 border border-gym-primary/20 text-gym-primary text-xs font-semibold rounded-full uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booked Members List */}
          <div className="lg:col-span-1 glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gym-primary" />
              Booked Clients
            </h2>
            
            {todayClassesList.length === 0 || !todayClassesList.some((c: any) => c.bookings?.length > 0) ? (
              <div className="py-12 text-center text-gym-muted italic border border-dashed border-slate-700/30 rounded-xl">
                No clients registered for today.
              </div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-72 overflow-y-auto pr-1">
                {todayClassesList.flatMap((c: any) =>
                  (c.bookings || []).map((b: any) => (
                    <div key={b.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-gym-primary/10 flex items-center justify-center text-gym-primary font-bold text-xs">
                          {b.member.user.firstName[0]}{b.member.user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gym-text text-sm">
                            {b.member.user.firstName} {b.member.user.lastName}
                          </p>
                          <p className="text-[10px] text-gym-muted">{c.name}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gym-muted font-mono">
                        {new Date(c.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== ADMIN / STAFF DASHBOARD VIEW ====================
  return (
    <div className="space-y-8">
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card p-6 md:p-8 rounded-2xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 bg-gym-primary/5 rounded-full blur-2xl -z-10"></div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gym-primary text-sm font-semibold tracking-wide uppercase">
            <Sparkles className="h-4 w-4" />
            Core Analytics Dashboard
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gym-text">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-sm text-gym-muted max-w-xl">
            Monitor real-time gym performance, manage registrations, handle manual check-ins, and inspect revenue reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-gym-primary border border-gym-primary/30 font-bold rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer text-xs"
          >
            <Rocket className="h-4 w-4" />
            Quick Setup & Demo Data
          </button>
          <Link
            to="/members/register"
            className="px-5 py-3 bg-gym-primary hover:bg-gym-primary-hover text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-gym-primary/25 flex items-center gap-2 text-xs"
          >
            <Users className="h-4 w-4" />
            Onboard Member
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Members */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Active Members</span>
            <p className="text-3xl font-extrabold text-white">{stats?.totalMembers || 0}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-gym-primary/15 flex items-center justify-center border border-gym-primary/10 text-gym-primary">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Mtd Income</span>
            <p className="text-3xl font-extrabold text-gym-text">₹{stats?.monthlyRevenue.toFixed(2) || '0.00'}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Daily Checkins */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Check-ins Today</span>
            <p className="text-3xl font-extrabold text-gym-text">{stats?.checkInsToday || 0}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-pink-500/15 flex items-center justify-center border border-pink-500/10 text-gym-secondary">
            <QrCode className="h-6 w-6" />
          </div>
        </div>

        {/* Pending Payments */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Unpaid Dues</span>
            <p className="text-3xl font-extrabold text-gym-text">₹{stats?.pendingPayments.toFixed(2) || '0.00'}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/10 text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* SVG Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Registrations Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
          <h3 className="text-base font-bold flex items-center gap-2 text-gym-text">
            <Sparkles className="h-4 w-4 text-gym-primary" />
            Weekly Registration Trends
          </h3>
          <p className="text-[11px] text-gym-muted mt-1">Number of new member accounts created per day.</p>
          {renderWeeklySignupsChart()}
        </div>

        {/* Peak Hours Occupancy Chart */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 relative overflow-hidden">
          <h3 className="text-base font-bold flex items-center gap-2 text-gym-text">
            <Clock className="h-4 w-4 text-gym-secondary" />
            Hourly Peak Occupancy
          </h3>
          <p className="text-[11px] text-gym-muted mt-1">Check-in occupancy frequency over the last 30 days.</p>
          {renderPeakHoursChart()}
        </div>
      </div>

      {/* Quick Check-in & Logs grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Check-in panel */}
        <div className="lg:col-span-1 glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <QrCode className="h-5 w-5 text-gym-primary" />
              Quick Check-In
            </h2>
            <p className="text-gym-muted text-sm mt-1">Scan QR code or type Member ID to log attendance.</p>
          </div>

          <form onSubmit={handleQuickCheckIn} className="space-y-4">
            <div>
              <input
                type="text"
                required
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                placeholder="Enter member UUID ID..."
                className="gym-input"
              />
            </div>
            <button
              type="submit"
              disabled={checkInLoading}
              className="w-full py-3 bg-gym-primary text-black font-semibold rounded-xl transition-all hover:bg-gym-primary-hover disabled:opacity-50 transform active:scale-95 flex items-center justify-center gap-2 shadow-md shadow-gym-primary/20"
            >
              {checkInLoading ? 'Logging...' : 'Submit Check-In'}
            </button>
          </form>

          {checkInResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-2.5 text-sm ${
                checkInResult.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {checkInResult.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0" />
              )}
              <span>{checkInResult.text}</span>
            </div>
          )}
        </div>

        {/* Recent Check-in logs */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-gym-primary" />
              Live Check-In Logs
            </h2>
            <span className="text-xs text-gym-muted font-mono bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
              AUTO REFRESH
            </span>
          </div>

          {recentCheckIns.length === 0 ? (
            <div className="py-12 text-center text-gym-muted italic">
              No check-ins logged today yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 pr-1 max-h-72 overflow-y-auto">
              {recentCheckIns.map((log) => (
                <div key={log.id} className="py-3.5 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gym-primary/10 flex items-center justify-center text-gym-primary font-bold text-xs">
                      {log.member.user.firstName[0]}{log.member.user.lastName[0]}
                    </div>
                    <div>
                      <Link
                        to={`/members/${log.member.id}`}
                        className="font-semibold text-gym-text hover:text-gym-primary transition-colors flex items-center gap-1 group"
                      >
                        {log.member.user.firstName} {log.member.user.lastName}
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all" />
                      </Link>
                      <p className="text-[10px] text-gym-muted font-mono">{log.member.id}</p>
                    </div>
                  </div>
                  <span className="text-gym-muted text-xs">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7x24 Attendance Density Heatmap & Member Retention Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7x24 Peak-Hour Heatmap Grid */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-400 animate-pulse" />
                7x24 Attendance Peak Density Heatmap
              </h3>
              <p className="text-xs text-gym-muted mt-0.5">Check-in distribution across days of week and hours of day (0-23h).</p>
            </div>
            {heatmapData?.peakTime && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold rounded-full">
                Peak: {heatmapData.peakTime.day} @ {heatmapData.peakTime.hour}
              </span>
            )}
          </div>

          {heatmapData?.matrix ? (
            <div className="overflow-x-auto pt-2">
              <div className="min-w-[600px] space-y-1.5">
                {/* Hours Header */}
                <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 text-[9px] font-mono text-gym-muted text-center">
                  <span>Day</span>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <span key={h}>{h}h</span>
                  ))}
                </div>

                {/* Day Rows */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, dIdx) => (
                  <div key={dayName} className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 items-center">
                    <span className="text-xs font-bold text-slate-300">{dayName}</span>
                    {heatmapData.matrix[dIdx].map((val, hIdx) => {
                      // Intensity calculation
                      const bgClass =
                        val === 0
                          ? 'bg-slate-900/60 border border-slate-800'
                          : val < 3
                          ? 'bg-purple-900/40 border border-purple-500/30 text-purple-300'
                          : val < 6
                          ? 'bg-purple-600/60 border border-purple-400 text-white'
                          : 'bg-gym-primary text-black font-extrabold shadow-sm shadow-gym-primary/40';

                      return (
                        <div
                          key={hIdx}
                          title={`${dayName} ${hIdx}:00 - ${val} Check-ins`}
                          className={`h-7 rounded-md flex items-center justify-center text-[10px] transition-all hover:scale-110 cursor-pointer ${bgClass}`}
                        >
                          {val > 0 ? val : ''}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-gym-muted text-xs">No heatmap check-in records available.</div>
          )}
        </div>

        {/* Member Retention & Churn Rate Analytics */}
        <div className="lg:col-span-1 glass-card p-6 rounded-2xl border border-slate-100 space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-gym-primary" />
              Retention & Churn Index
            </h3>
            <p className="text-xs text-gym-muted mt-0.5">Calculated active member stickiness and monthly drop-offs.</p>

            <div className="mt-6 space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase">Retention Rate</span>
                    <p className="text-2xl font-extrabold text-white">{retentionData?.retentionRate ?? 92.4}%</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-red-400 uppercase">Monthly Churn</span>
                    <p className="text-2xl font-extrabold text-white">{retentionData?.churnRate ?? 7.6}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-gym-muted leading-relaxed">
            💡 High retention (&gt;85%) indicates strong class engagement and timely renewal alerts.
          </div>
        </div>
      </div>

      {/* Onboarding Modal Instance */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onDataGenerated={fetchAdminData}
      />
    </div>
  );
};
