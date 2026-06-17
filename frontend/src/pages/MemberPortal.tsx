import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../utils/api.js';
import {
  Users,
  Clock,
  QrCode,
  CreditCard,
  User,
  ShieldAlert,
  Loader2,
  CalendarCheck,
  CheckCircle,
  Plus
} from 'lucide-react';

interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
}

interface Booking {
  id: string;
  memberId: string;
  status: string;
}

interface GroupClass {
  id: string;
  name: string;
  description?: string;
  trainer: Trainer;
  dateTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: Booking[];
}

export const MemberPortal: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [classes, setClasses] = useState<GroupClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberId = user?.member?.id;
  const memberStatus = user?.member?.status;

  const fetchClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await apiFetch<{ classes: GroupClass[] }>('/classes');
      setClasses(data.classes);
    } catch (err: any) {
      console.error('Failed to load class schedules:', err);
      setError('Could not retrieve class calendar schedules.');
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    // Refresh user profile info on mount to ensure billing/subscription status is latest
    refreshProfile();
  }, []);

  const handleBookClass = async (classId: string) => {
    if (!memberId) return;
    if (memberStatus !== 'ACTIVE') {
      alert('Class registration denied: Your membership status is currently inactive.');
      return;
    }

    setBookingActionId(classId);
    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body: { classId, memberId }
      });
      await fetchClasses();
    } catch (err: any) {
      alert(err.message || 'Failed to complete booking');
    } finally {
      setBookingActionId(null);
    }
  };

  const handleCancelBooking = async (classId: string) => {
    if (!memberId) return;
    if (!confirm('Are you sure you want to cancel your registration for this fitness class?')) return;

    setBookingActionId(classId);
    try {
      await apiFetch('/bookings/cancel', {
        method: 'POST',
        body: { classId, memberId }
      });
      await fetchClasses();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setBookingActionId(null);
    }
  };

  // Get current subscription details
  const activeSubscription = user?.member?.subscriptions?.[0];
  const activePlan = activeSubscription?.plan;
  const payments = activeSubscription?.payments || [];

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="text-gym-muted mt-1">
          Access your digital gym card, monitor your active plan, and sign up for fitness classes.
        </p>
      </div>

      {/* Main Grid: Info Passes & Digital QR Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Card 1: Digital Gym Pass */}
        <div className="glass-card rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-between space-y-6 bg-gradient-to-b from-gym-card/40 to-gym-darker/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gym-primary/10 rounded-full blur-3xl group-hover:bg-gym-primary/20 transition-all"></div>
          
          <div className="w-full text-center space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gym-primary flex items-center justify-center gap-1.5">
              <QrCode className="h-4.5 w-4.5" />
              Digital Check-In QR Pass
            </h2>
            <p className="text-xs text-gym-muted">Present this screen to the reception scanner for fast check-in.</p>
          </div>

          {memberId ? (
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xl relative">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=0f172a&data=${memberId}`}
                alt="Gym Check-In QR Code"
                className="w-40 h-40 object-contain"
              />
            </div>
          ) : (
            <div className="w-40 h-40 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center p-4">
              <ShieldAlert className="h-10 w-10 text-red-400 mb-2" />
              <span className="text-[11px] text-gym-muted font-bold uppercase">No Active Profile</span>
            </div>
          )}

          <div className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-gym-muted font-medium">Card Status:</span>
            <span
              className={`font-extrabold uppercase px-2.5 py-0.5 rounded-lg border ${
                memberStatus === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}
            >
              {memberStatus || 'UNREGISTERED'}
            </span>
          </div>
        </div>

        {/* Card 2: Plan & Membership Details */}
        <div className="glass-card rounded-2xl border border-slate-100 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gym-secondary flex items-center gap-1.5">
                <User className="h-4.5 w-4.5" />
                Membership Details
              </h2>
              <p className="text-xs text-gym-muted">Your active plan levels and key billing timelines.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gym-muted">Active Plan:</span>
                <span className="font-extrabold text-gym-text">{activePlan ? activePlan.name : 'No Active Plan'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gym-muted">Billing Cycle:</span>
                <span className="font-medium text-gym-text">
                  {activePlan ? `${activePlan.durationMonths} Month(s)` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gym-muted">Member ID:</span>
                <span className="font-mono text-xs text-gym-muted truncate max-w-[150px]">{memberId || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gym-muted">Join Date:</span>
                <span className="font-medium text-gym-text">
                  {user?.member?.joinDate ? new Date(user.member.joinDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gym-muted">Emergency Contact:</span>
                <span className="font-medium text-gym-text">{user?.member?.emergencyContact || 'Not Set'}</span>
              </div>
            </div>
          </div>

          {!activePlan && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>You have no active plan subscription. Visit the front desk to configure a membership plan.</span>
            </div>
          )}
        </div>

        {/* Card 3: Invoicing / Transaction Log */}
        <div className="glass-card rounded-2xl border border-slate-100 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4 flex-1">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CreditCard className="h-4.5 w-4.5" />
                Latest Payments
              </h2>
              <p className="text-xs text-gym-muted">Recent billing ledger records.</p>
            </div>

            <div className="space-y-3 pt-2 overflow-y-auto max-h-[160px]">
              {payments.length === 0 ? (
                <div className="text-center text-gym-muted text-xs italic py-8">
                  No payment records found.
                </div>
              ) : (
                payments.slice(0, 3).map((payment: any) => (
                  <div key={payment.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <div>
                      <p className="text-xs font-bold text-gym-text">${payment.amount.toFixed(2)}</p>
                      <p className="text-[10px] text-gym-muted font-mono">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        payment.status === 'PAID'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Group Fitness Class Schedules Calendar */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-gym-primary" />
            Class Reservation Schedules
          </h2>
          <p className="text-gym-muted text-sm mt-1">
            Explore group class times, view available capacity slots, and sign up for workout sessions.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loadingClasses ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gym-primary" />
          </div>
        ) : classes.length === 0 ? (
          <div className="glass-card rounded-2xl border border-slate-100 p-16 text-center text-gym-muted italic">
            No group fitness classes have been scheduled yet. Check back later!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((gClass) => {
              const dateObj = new Date(gClass.dateTime);
              const dayName = dateObj.toLocaleDateString([], { weekday: 'long' });
              const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
              const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              
              const isBooked = gClass.bookings.some(
                b => b.memberId === memberId && b.status === 'CONFIRMED'
              );
              const bookedCount = gClass.bookings.length;
              const isFull = bookedCount >= gClass.capacity;
              const isActioning = bookingActionId === gClass.id;

              return (
                <div
                  key={gClass.id}
                  className={`glass-card rounded-2xl border p-6 flex flex-col justify-between space-y-4 hover:border-gym-primary/20 transition-all ${
                    isBooked ? 'border-gym-primary/20 bg-gym-primary/5' : 'border-slate-100'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gym-primary/10 text-gym-primary border border-gym-primary/20">
                        {dayName}, {dateString}
                      </span>
                      {isBooked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">
                          <CheckCircle className="h-3 w-3" />
                          Reserved
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-gym-text text-lg leading-tight">{gClass.name}</h3>
                      <p className="text-gym-muted text-xs mt-1 line-clamp-2">{gClass.description || 'No class description provided.'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium text-gym-muted">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gym-secondary" />
                        <span>{timeString} ({gClass.durationMinutes}m)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Coach {gClass.trainer?.firstName || 'Staff'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span className="text-gym-muted">Roster Availability</span>
                      <span className={isFull && !isBooked ? 'text-red-400 font-extrabold' : 'text-gym-text'}>
                        {bookedCount} / {gClass.capacity} slots filled
                      </span>
                    </div>

                    {isBooked ? (
                      <button
                        onClick={() => handleCancelBooking(gClass.id)}
                        disabled={isActioning}
                        className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isActioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          'Cancel Class Reservation'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBookClass(gClass.id)}
                        disabled={isActioning || isFull || memberStatus !== 'ACTIVE'}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                          isFull
                            ? 'bg-slate-50 text-gym-muted border border-slate-200 cursor-not-allowed'
                            : 'bg-gym-primary hover:bg-gym-primary/80 text-white'
                        }`}
                      >
                        {isActioning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isFull ? (
                          'Session Fully Booked'
                        ) : memberStatus !== 'ACTIVE' ? (
                          'Membership Status Inactive'
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Book Free Spot
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
