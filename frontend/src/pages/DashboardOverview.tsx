import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import {
  Users,
  QrCode,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<RecentCheckIn[]>([]);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Kiosk scanner state
  const [memberIdInput, setMemberIdInput] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  // 1. Weekly Registration Signups SVG Calculations
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

        {/* Horizontal gridlines */}
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

        {/* Bars */}
        {data.map((item, i) => {
          const x = barSpacing + i * (barWidth + barSpacing) + 20;
          const barHeight = (item.count / maxVal) * chartHeight;
          const y = chartHeight - barHeight + 10;

          return (
            <g key={item.day} className="group">
              {/* Main Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 3)} // Ensure small visual bar even for 0
                rx="6"
                fill="url(#barGradient)"
                className="transition-all duration-300 hover:fill-gym-secondary"
              />
              
              {/* Tooltip value */}
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

              {/* Day Label */}
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

  // 2. Peak Hours Check-Ins SVG Calculations
  const renderPeakHoursChart = () => {
    if (!charts || !charts.peakHours || charts.peakHours.length === 0) {
      return <div className="text-gym-muted text-xs py-8 text-center">No occupancy logs available.</div>;
    }

    const data = charts.peakHours;
    const maxVal = Math.max(...data.map((d) => d.count), 5);
    const chartHeight = 120;
    const chartWidth = 440;
    const paddingX = 35;

    // Calculate line points
    const points = data.map((item, index) => {
      const x = paddingX + index * ((chartWidth - paddingX - 15) / (data.length - 1));
      const y = chartHeight - (item.count / maxVal) * chartHeight + 15;
      return { x, y, count: item.count, hour: item.hour };
    });

    const linePath = points.reduce(
      (path, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${path} L ${p.x} ${p.y}`),
      ''
    );

    const areaPath =
      points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${chartHeight + 15} L ${points[0].x} ${chartHeight + 15} Z`
        : '';

    return (
      <svg className="w-full h-44 mt-4" viewBox={`0 0 ${chartWidth} 170`}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.5, 1].map((ratio, index) => {
          const y = 15 + ratio * chartHeight;
          const label = Math.round(maxVal * (1 - ratio));
          return (
            <g key={index}>
              <line
                x1={paddingX}
                y1={y}
                x2={chartWidth - 15}
                y2={y}
                stroke="white"
                strokeOpacity="0.04"
                strokeDasharray="4 4"
              />
              <text x="5" y={y + 3} fill="#94a3b8" fontSize="9" opacity="0.6">
                {label}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        {points.length > 0 && <path d={areaPath} fill="url(#areaGrad)" />}

        {/* Spline line */}
        {points.length > 0 && (
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="3" strokeLinecap="round" />
        )}

        {/* Data points & labels */}
        {points.map((p, i) => (
          <g key={i} className="group">
            {/* Glowing dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              className="fill-gym-primary stroke-gym-darker stroke-2 hover:r-6 cursor-pointer transition-all"
            />
            {/* Tooltip value */}
            <text
              x={p.x}
              y={p.y - 8}
              fill="#ffffff"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              {p.count}
            </text>

            {/* Hour label */}
            <text
              x={p.x}
              y={chartHeight + 33}
              fill="#94a3b8"
              fontSize="9"
              textAnchor="middle"
              transform={`rotate(-25, ${p.x}, ${chartHeight + 33})`}
            >
              {p.hour}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-gym-muted mt-1">Real-time gym performance and reception logs.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Members */}
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
            <p className="text-3xl font-extrabold text-white">${stats?.monthlyRevenue.toFixed(2) || '0.00'}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Daily Checkins */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Check-ins Today</span>
            <p className="text-3xl font-extrabold text-white">{stats?.checkInsToday || 0}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-pink-500/15 flex items-center justify-center border border-pink-500/10 text-gym-secondary">
            <QrCode className="h-6 w-6" />
          </div>
        </div>

        {/* Pending Payments */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 flex items-center justify-between relative group hover:border-gym-primary/20 transition-all">
          <div className="space-y-2">
            <span className="text-sm font-medium text-gym-muted uppercase tracking-wider">Unpaid Dues</span>
            <p className="text-3xl font-extrabold text-white">${stats?.pendingPayments.toFixed(2) || '0.00'}</p>
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
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text placeholder-gym-muted focus:border-gym-primary focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={checkInLoading}
              className="w-full py-3 bg-gym-primary text-white font-semibold rounded-xl transition-all hover:bg-gym-primary/80 disabled:opacity-50 transform active:scale-95 flex items-center justify-center gap-2"
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
            <span className="text-xs text-gym-muted font-mono bg-slate-50 px-2.5 py-1 rounded-full">
              AUTO REFRESH
            </span>
          </div>

          {recentCheckIns.length === 0 ? (
            <div className="py-12 text-center text-gym-muted italic">
              No check-ins logged today yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 pr-1 max-h-72 overflow-y-auto">
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
    </div>
  );
};
