import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../utils/api.js';
import { Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Dumbbell,
  Apple,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RefreshCw,
  UserCheck,
  Loader2,
  XCircle,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface PTMember {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  joinDate: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  subscriptions: Array<{
    endDate: string;
    plan: { name: string; price: number };
  }>;
  progressLogs: Array<{ weightKg: number; loggedAt: string }>;
  checkIns: Array<{ timestamp: string }>;
  workoutPlan: { id: string; name: string; updatedAt: string } | null;
  dietPlan: { id: string; name: string; updatedAt: string } | null;
}

interface ScheduledClass {
  id: string;
  name: string;
  description?: string;
  dateTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: Array<{
    member: { user: { firstName: string; lastName: string } };
  }>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PAUSED': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-red-50 text-red-700 border-red-200';
  }
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export const TrainerPortal: React.FC = () => {
  const { user } = useAuth();

  const [ptMembers, setPtMembers] = useState<PTMember[]>([]);
  const [schedule, setSchedule] = useState<ScheduledClass[]>([]);
  const [trainerIsActive, setTrainerIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'schedule'>('members');

  // Progress log modal
  const [logModal, setLogModal] = useState<{ open: boolean; memberId: string; memberName: string }>({
    open: false, memberId: '', memberName: '',
  });
  const [logForm, setLogForm] = useState({ weightKg: '', bodyFat: '', muscleMass: '' });
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState('');
  const [logSuccess, setLogSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, scheduleRes] = await Promise.all([
        apiFetch<{ ptMembers: PTMember[] }>('/trainers/me/members'),
        apiFetch<{ classes: ScheduledClass[]; isActive: boolean }>('/trainers/me/schedule'),
      ]);
      setPtMembers(membersRes.ptMembers || []);
      setSchedule(scheduleRes.classes || []);
      setTrainerIsActive(scheduleRes.isActive ?? true);
    } catch (err: any) {
      setError(err.message || 'Failed to load trainer data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogProgress = async () => {
    if (!logForm.weightKg) { setLogError('Weight is required.'); return; }
    setLogLoading(true);
    setLogError('');
    setLogSuccess('');
    try {
      await apiFetch(`/members/${logModal.memberId}/progress`, {
        method: 'POST',
        body: { weightKg: logForm.weightKg, bodyFat: logForm.bodyFat || undefined, muscleMass: logForm.muscleMass || undefined },
      });
      setLogSuccess('Progress logged successfully!');
      setLogForm({ weightKg: '', bodyFat: '', muscleMass: '' });
      fetchData(); // refresh
    } catch (err: any) {
      setLogError(err.message || 'Failed to log progress.');
    } finally {
      setLogLoading(false);
    }
  };

  /* ── Loading / Error states ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <Loader2 className="h-8 w-8 text-gym-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-gym-primary text-white rounded-lg text-sm font-medium hover:bg-gym-primary/80 transition-colors">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  /* ── Inactive trainer warning ──────────────────────────────────────── */
  const inactiveBanner = !trainerIsActive && (
    <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
      Your trainer profile is currently marked as <strong>Inactive</strong>. You cannot be assigned to new classes. Contact an admin to reactivate your profile.
    </div>
  );

  /* ── Stats Summary ─────────────────────────────────────────────────── */
  const expiringCount = ptMembers.filter(m => {
    const sub = m.subscriptions[0];
    return sub && daysUntil(sub.endDate) <= 7 && daysUntil(sub.endDate) > 0;
  }).length;

  const todayClasses = schedule.filter(c => {
    const d = new Date(c.dateTime);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Trainer Dashboard — manage your PT clients and schedule</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gym-primary border border-slate-200 rounded-lg hover:border-gym-primary transition-all"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {inactiveBanner}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'PT Members', value: ptMembers.length, icon: Users, color: 'bg-violet-50 text-violet-600' },
          { label: 'Classes Today', value: todayClasses, icon: Calendar, color: 'bg-sky-50 text-sky-600' },
          { label: 'Upcoming Classes', value: schedule.length, icon: Clock, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Expiring Soon', value: expiringCount, icon: AlertTriangle, color: expiringCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['members', 'schedule'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'text-gym-primary border-b-2 border-gym-primary bg-violet-50'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab === 'members' ? `My PT Clients (${ptMembers.length})` : `My Schedule (${schedule.length})`}
          </button>
        ))}
      </div>

      {/* PT Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {ptMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <UserCheck className="h-12 w-12 mb-3 text-slate-300" />
              <p className="font-medium text-gray-500">No PT members assigned yet</p>
              <p className="text-sm mt-1">Contact your branch admin to assign members to you.</p>
            </div>
          ) : (
            ptMembers.map(member => {
              const activeSub = member.subscriptions[0];
              const days = activeSub ? daysUntil(activeSub.endDate) : null;
              const lastLog = member.progressLogs[0];
              const lastCheckIn = member.checkIns[0];

              return (
                <div
                  key={member.id}
                  className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-violet-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Member Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {member.user.firstName[0]}{member.user.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{member.user.firstName} {member.user.lastName}</p>
                        <p className="text-xs text-gray-400 truncate">{member.user.email}</p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(member.status)}`}>
                      {member.status}
                    </span>
                  </div>

                  {/* Subscription & expiry */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-gray-400 font-medium mb-0.5">Plan</p>
                      <p className="font-semibold text-gray-800 truncate">{activeSub?.plan.name ?? '—'}</p>
                    </div>
                    <div className={`rounded-lg p-2.5 ${days !== null && days <= 7 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                      <p className="text-gray-400 font-medium mb-0.5">Expires</p>
                      <p className={`font-semibold truncate ${days !== null && days <= 7 ? 'text-amber-700' : 'text-gray-800'}`}>
                        {activeSub ? `${formatDate(activeSub.endDate)}${days !== null ? ` (${days}d)` : ''}` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-gray-400 font-medium mb-0.5">Last Check-in</p>
                      <p className="font-semibold text-gray-800 truncate">{lastCheckIn ? formatDate(lastCheckIn.timestamp) : '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-gray-400 font-medium mb-0.5">Last Weight</p>
                      <p className="font-semibold text-gray-800">{lastLog ? `${lastLog.weightKg} kg` : '—'}</p>
                    </div>
                  </div>

                  {/* Plan status indicators */}
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${member.workoutPlan ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <Dumbbell className="h-3.5 w-3.5" />
                      {member.workoutPlan ? `Workout: ${member.workoutPlan.name}` : 'No Workout Plan'}
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${member.dietPlan ? 'text-emerald-600' : 'text-gray-400'}`}>
                      <Apple className="h-3.5 w-3.5" />
                      {member.dietPlan ? `Diet: ${member.dietPlan.name}` : 'No Diet Plan'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/members/${member.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      <Activity className="h-3.5 w-3.5" /> Full Profile
                    </Link>
                    <button
                      onClick={() => {
                        setLogModal({ open: true, memberId: member.id, memberName: `${member.user.firstName} ${member.user.lastName}` });
                        setLogForm({ weightKg: '', bodyFat: '', muscleMass: '' });
                        setLogError('');
                        setLogSuccess('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <TrendingUp className="h-3.5 w-3.5" /> Log Progress
                    </button>
                    {days !== null && days <= 7 && days > 0 && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5" /> Expiring in {days} day{days !== 1 ? 's' : ''}
                      </span>
                    )}
                    {member.status === 'INACTIVE' && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-600 border border-red-200 rounded-lg">
                        <XCircle className="h-3.5 w-3.5" /> Membership Expired
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-3">
          {schedule.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <Calendar className="h-12 w-12 mb-3 text-slate-300" />
              <p className="font-medium text-gray-500">No upcoming classes scheduled</p>
              <p className="text-sm mt-1">Ask your branch admin to assign group classes to you.</p>
            </div>
          ) : (
            schedule.map(cls => {
              const today = new Date();
              const classDate = new Date(cls.dateTime);
              const isToday =
                classDate.getDate() === today.getDate() &&
                classDate.getMonth() === today.getMonth() &&
                classDate.getFullYear() === today.getFullYear();
              const enrolled = cls.bookings.length;
              const spotsLeft = cls.capacity - enrolled;

              return (
                <div
                  key={cls.id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
                    isToday ? 'border-violet-300 bg-violet-50/30' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{cls.name}</h3>
                        {isToday && (
                          <span className="px-2 py-0.5 text-xs font-bold bg-violet-600 text-white rounded-full">TODAY</span>
                        )}
                      </div>
                      {cls.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{cls.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2.5 py-1 rounded-lg font-medium text-xs ${spotsLeft === 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {enrolled}/{cls.capacity} enrolled
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-violet-500" />
                      {formatDateTime(cls.dateTime)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-violet-500" />
                      {cls.durationMinutes} min
                    </span>
                  </div>

                  {/* Enrolled members list */}
                  {cls.bookings.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Enrolled Members</p>
                      <div className="flex flex-wrap gap-2">
                        {cls.bookings.map((b, idx) => (
                          <span key={idx} className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-gray-700 rounded-full text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            {b.member.user.firstName} {b.member.user.lastName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Progress Log Modal */}
      {logModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Log Progress</h2>
                <p className="text-sm text-gray-500">{logModal.memberName}</p>
              </div>
              <button
                onClick={() => setLogModal({ open: false, memberId: '', memberName: '' })}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <XCircle className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (kg) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.1"
                  value={logForm.weightKg}
                  onChange={e => setLogForm(p => ({ ...p, weightKg: e.target.value }))}
                  placeholder="e.g. 72.5"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-gray-900 bg-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Body Fat %</label>
                <input
                  type="number"
                  step="0.1"
                  value={logForm.bodyFat}
                  onChange={e => setLogForm(p => ({ ...p, bodyFat: e.target.value }))}
                  placeholder="e.g. 18.5"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-gray-900 bg-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Muscle Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={logForm.muscleMass}
                  onChange={e => setLogForm(p => ({ ...p, muscleMass: e.target.value }))}
                  placeholder="e.g. 35.2"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-gray-900 bg-white focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 text-sm"
                />
              </div>
            </div>

            {logError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600 font-medium">
                <AlertTriangle className="h-4 w-4" /> {logError}
              </p>
            )}
            {logSuccess && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="h-4 w-4" /> {logSuccess}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setLogModal({ open: false, memberId: '', memberName: '' })}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogProgress}
                disabled={logLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 transition-colors"
              >
                {logLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                {logLoading ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
