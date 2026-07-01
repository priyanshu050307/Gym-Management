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
  Plus,
  Dumbbell,
  Apple,
  TrendingUp,
  History,
  Printer,
  Upload,
  Heart,
  Star
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

export const printInvoice = (payment: any, memberName: string, planName: string, branchName: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <html>
      <head>
        <title>Invoice - ${payment.id.slice(0, 8)}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .gym-logo { font-size: 24px; font-weight: 800; text-transform: uppercase; background: #0f172a; color: #fff; padding: 4px 12px; border-radius: 6px; display: inline-block; }
          .invoice-title { font-size: 28px; font-weight: 900; text-align: right; text-transform: uppercase; color: #0f172a; }
          .details { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
          .value { font-size: 14px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 12px; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #64748b; text-align: left; }
          td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
          .total-row { display: flex; justify-content: space-between; width: 300px; font-size: 14px; }
          .grand-total { font-size: 18px; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 10px; color: #0f172a; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 60px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
          .print-btn { background: #0f172a; color: white; padding: 10px 20px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; display: block; margin: 0 auto 30px auto; }
        </style>
      </head>
      <body>
        <button class="print-btn no-print" onclick="window.print()">Print Invoice</button>
        <div class="header">
          <div>
            <div class="gym-logo">GYMFLOW</div>
            <p style="font-size: 12px; color: #64748b; margin: 6px 0 0 0;">${branchName}</p>
          </div>
          <div>
            <div class="invoice-title">Tax Invoice</div>
            <p style="font-size: 12px; color: #64748b; text-align: right; margin: 4px 0 0 0;">Invoice ID: ${payment.id}</p>
          </div>
        </div>

        <div class="details">
          <div>
            <div class="section-title">Billed To</div>
            <div class="value" style="font-size: 16px; font-weight: 800;">${memberName}</div>
            <div class="value" style="color: #64748b; margin-top: 4px;">Gym Member</div>
          </div>
          <div style="text-align: right;">
            <div class="section-title">Invoice Details</div>
            <div class="value">Date: ${new Date(payment.paymentDate).toLocaleDateString()}</div>
            <div class="value">Payment Method: ${payment.method}</div>
            <div class="value" style="color: #10b981; font-weight: 800; text-transform: uppercase;">Status: ${payment.status}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Duration</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 700;">Gym Membership - ${planName}</td>
              <td style="text-align: right;">Active Period</td>
              <td style="text-align: right;">₹${payment.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span style="color: #64748b;">Subtotal</span>
            <span style="font-weight: 600;">₹${(payment.amount + payment.discount).toFixed(2)}</span>
          </div>
          ${payment.discount > 0 ? `
          <div class="total-row" style="color: #ef4444;">
            <span>Discount Applied</span>
            <span>-₹${payment.discount.toFixed(2)}</span>
          </div>` : ''}
          <div class="total-row grand-total">
            <span>Grand Total</span>
            <span>₹${payment.amount.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for training with GymFlow! For support, contact your branch reception.</p>
          <p style="margin-top: 6px;">This is a computer-generated document and requires no physical signature.</p>
        </div>
      </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
};

export const MemberPortal: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [classes, setClasses] = useState<GroupClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const memberId = user?.member?.id;
  const memberStatus = user?.member?.status;

  // Custom tabs & sub-module states
  const [portalTab, setPortalTab] = useState<'overview' | 'workout' | 'diet' | 'progress' | 'profile' | 'attendance'>('overview');
  const [workout, setWorkout] = useState<any>(null);
  const [diet, setDiet] = useState<any>(null);
  const [progressLogs, setProgressLogs] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);

  // Weekly Calendar Schedule Picker state
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>(() => {
    return new Date().toLocaleDateString('en-US', { weekday: 'long' });
  });

  // Profile health states
  const [emergencyContact, setEmergencyContact] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Trainer Feedback states
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccessMsg, setFeedbackSuccessMsg] = useState('');

  // Log weight form states
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newMuscleMass, setNewMuscleMass] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

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

  const fetchPortalData = async () => {
    if (!memberId) return;
    try {
      const wRes = await apiFetch<any>(`/members/${memberId}/workout`);
      setWorkout(wRes.workoutPlan);

      const dRes = await apiFetch<any>(`/members/${memberId}/diet`);
      setDiet(dRes.dietPlan);

      const pRes = await apiFetch<any>(`/members/${memberId}/progress`);
      setProgressLogs(pRes.logs || []);

      const aRes = await apiFetch<any>(`/members/${memberId}/attendance`);
      setAttendance(aRes.attendance || []);
    } catch (err) {
      console.error('Error loading member portal data:', err);
    }
  };

  const handleLogProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !newWeight) return;

    setSavingProgress(true);
    try {
      await apiFetch(`/members/${memberId}/progress`, {
        method: 'POST',
        body: {
          weightKg: parseFloat(newWeight),
          bodyFat: newBodyFat ? parseFloat(newBodyFat) : undefined,
          muscleMass: newMuscleMass ? parseFloat(newMuscleMass) : undefined,
        },
      });
      setNewWeight('');
      setNewBodyFat('');
      setNewMuscleMass('');
      
      const pRes = await apiFetch<any>(`/members/${memberId}/progress`);
      setProgressLogs(pRes.logs || []);
    } catch (err: any) {
      alert(err.message || 'Failed to log progress');
    } finally {
      setSavingProgress(false);
    }
  };

  const fetchTrainers = async () => {
    try {
      const data = await apiFetch<{ trainers: any[] }>('/trainers');
      setTrainers(data.trainers || []);
    } catch (err) {
      console.error('Failed to fetch trainers:', err);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) return;

    setUpdatingProfile(true);
    setProfileSuccessMsg('');
    try {
      await apiFetch(`/members/${memberId}/profile`, {
        method: 'PUT',
        body: {
          emergencyContact,
          medicalHistory,
          profilePhoto,
        },
      });
      setProfileSuccessMsg('Health profile and photo updated successfully!');
      refreshProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to update health profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !selectedTrainerId) return;

    setSubmittingFeedback(true);
    setFeedbackSuccessMsg('');
    try {
      await apiFetch(`/members/${memberId}/feedback`, {
        method: 'POST',
        body: {
          trainerId: selectedTrainerId,
          rating: feedbackRating,
          feedback: feedbackText,
        },
      });
      setFeedbackSuccessMsg('Thank you! Your feedback has been submitted.');
      setSelectedTrainerId('');
      setFeedbackText('');
      setFeedbackRating(5);
    } catch (err: any) {
      alert(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    if (user?.member) {
      const mbr = user.member as any;
      setEmergencyContact(mbr.emergencyContact || '');
      setMedicalHistory(mbr.medicalHistory || '');
      setProfilePhoto(mbr.profilePhoto || '');
    }
  }, [user]);

  useEffect(() => {
    fetchClasses();
    fetchPortalData();
    fetchTrainers();
    // Refresh user profile info on mount to ensure billing/subscription status is latest
    refreshProfile();
  }, [memberId]);

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
          Access your digital gym card, monitor your active plan, workouts, diet, and track your progress.
        </p>
      </div>

      {/* Tab Navigation Menu */}
      <div className="flex flex-wrap border-b border-slate-800 gap-6">
        <button
          onClick={() => setPortalTab('overview')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'overview'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <QrCode className="h-4.5 w-4.5" />
          Overview & Pass
        </button>
        <button
          onClick={() => setPortalTab('workout')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'workout'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <Dumbbell className="h-4.5 w-4.5" />
          My Workouts
        </button>
        <button
          onClick={() => setPortalTab('diet')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'diet'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <Apple className="h-4.5 w-4.5" />
          My Nutrition
        </button>
        <button
          onClick={() => setPortalTab('progress')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'progress'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <TrendingUp className="h-4.5 w-4.5" />
          Progress Tracker
        </button>
        <button
          onClick={() => setPortalTab('profile')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'profile'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <User className="h-4.5 w-4.5" />
          My Profile & Health
        </button>
        <button
          onClick={() => setPortalTab('attendance')}
          className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 flex items-center gap-2 ${
            portalTab === 'attendance'
              ? 'border-gym-primary text-gym-primary'
              : 'border-transparent text-gym-muted hover:text-gym-text'
          }`}
        >
          <History className="h-4.5 w-4.5" />
          Attendance History
        </button>
      </div>

      {portalTab === 'overview' && (
        <>
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
                          <p className="text-xs font-bold text-gym-text">₹{payment.amount.toFixed(2)}</p>
                          <p className="text-[10px] text-gym-muted font-mono">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              payment.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }`}
                          >
                            {payment.status}
                          </span>
                          <button
                            onClick={() => printInvoice(
                              payment,
                              `${user?.firstName} ${user?.lastName}`,
                              activePlan?.name || 'Standard Plan',
                              user?.branch?.name || 'Main Branch'
                            )}
                            className="p-1 hover:bg-slate-200 text-gym-muted hover:text-gym-text rounded transition-all"
                            title="Print Invoice Receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
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
              <div className="space-y-6">
                {/* Visual Calendar Day Picker */}
                <div className="flex flex-wrap gap-2 pb-2">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const count = classes.filter(
                      c => new Date(c.dateTime).toLocaleDateString('en-US', { weekday: 'long' }) === day
                    ).length;
                    const isSelected = selectedCalendarDay === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedCalendarDay(day)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-gym-primary text-white border-gym-primary shadow-lg shadow-gym-primary/20'
                            : 'bg-slate-50 text-gym-muted border-slate-100 hover:bg-slate-100 hover:text-gym-text'
                        }`}
                      >
                        <span>{day.slice(0, 3)}</span>
                        {count > 0 && (
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-gym-text'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {classes.filter(c => new Date(c.dateTime).toLocaleDateString('en-US', { weekday: 'long' }) === selectedCalendarDay).length === 0 ? (
                  <div className="glass-card rounded-2xl border border-slate-100 p-12 text-center text-gym-muted italic text-sm">
                    No fitness sessions scheduled for {selectedCalendarDay}. Choose another day!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes
                      .filter(c => new Date(c.dateTime).toLocaleDateString('en-US', { weekday: 'long' }) === selectedCalendarDay)
                      .map((gClass) => {
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
            )}
          </div>
        </>
      )}

      {portalTab === 'workout' && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
          {workout ? (
            <>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gym-primary bg-gym-primary/10 px-2.5 py-1 rounded-lg border border-gym-primary/20">
                  Active Routine
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-3">{workout.name}</h2>
                {workout.description && <p className="text-gym-muted text-sm mt-1">{workout.description}</p>}
              </div>

              <div className="space-y-6 pt-2">
                {workout.days?.map((day: any) => (
                  <div key={day.id} className="border border-slate-800 rounded-xl p-5 bg-slate-950/20 space-y-4">
                    <h3 className="font-extrabold text-gym-text text-base flex items-center gap-2">
                      <Dumbbell className="h-4.5 w-4.5 text-gym-primary" />
                      {day.dayOfWeek}
                    </h3>

                    {day.exercises?.length === 0 ? (
                      <p className="text-xs text-gym-muted italic">Rest Day / Active recovery.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-gym-muted font-bold">
                              <th className="py-2.5 pr-4">Exercise</th>
                              <th className="py-2.5 px-4 text-center">Sets</th>
                              <th className="py-2.5 px-4 text-center">Reps</th>
                              <th className="py-2.5 px-4 text-center">Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 font-medium">
                            {day.exercises?.map((ex: any) => (
                              <tr key={ex.id} className="text-gym-text hover:bg-slate-900/10 transition-colors">
                                <td className="py-3 pr-4 font-bold">{ex.name}</td>
                                <td className="py-3 px-4 text-center">{ex.sets}</td>
                                <td className="py-3 px-4 text-center">{ex.reps}</td>
                                <td className="py-3 px-4 text-center">{ex.weightLbs ? `${ex.weightLbs} lbs` : 'Bodyweight'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center p-16 border border-dashed border-slate-200 rounded-2xl text-gym-muted">
              <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gym-muted/40" />
              <p className="font-bold text-sm">No Workout Plan Assigned</p>
              <p className="text-xs mt-1">Check back soon or consult your fitness coach to set up your workout splits.</p>
            </div>
          )}
        </div>
      )}

      {portalTab === 'diet' && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
          {diet ? (
            <>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gym-secondary bg-gym-secondary/10 px-2.5 py-1 rounded-lg border border-gym-secondary/20">
                  Nutrition Guideline
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-3">{diet.name}</h2>
                {diet.description && <p className="text-gym-muted text-sm mt-1">{diet.description}</p>}
              </div>

              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-gym-muted font-bold">
                      <th className="py-3 pr-4">Meal</th>
                      <th className="py-3 px-4">Scheduled Time</th>
                      <th className="py-3 px-4">Ingredients & Items</th>
                      <th className="py-3 px-4 text-center">Calories</th>
                      <th className="py-3 px-4 text-center">Macros (P/C/F)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-medium">
                    {diet.meals?.map((meal: any) => (
                      <tr key={meal.id} className="text-gym-text hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 pr-4 font-bold">{meal.name}</td>
                        <td className="py-4 px-4 text-gym-muted">{meal.time || 'Flexible'}</td>
                        <td className="py-4 px-4 max-w-xs truncate">{meal.items}</td>
                        <td className="py-4 px-4 text-center font-bold text-gym-primary">{meal.calories ? `${meal.calories} kcal` : 'N/A'}</td>
                        <td className="py-4 px-4 text-center font-mono text-gym-muted">
                          {meal.protein || 0}g / {meal.carbs || 0}g / {meal.fat || 0}g
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center p-16 border border-dashed border-slate-200 rounded-2xl text-gym-muted">
              <Apple className="h-12 w-12 mx-auto mb-4 text-gym-muted/40" />
              <p className="font-bold text-sm">No Nutrition Plan Configured</p>
              <p className="text-xs mt-1">Consult your personal trainer or dietician to generate your diet splits.</p>
            </div>
          )}
        </div>
      )}

      {portalTab === 'progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add entry form */}
          <div className="lg:col-span-1 glass-card p-6 rounded-2xl border border-slate-100 h-fit space-y-4">
            <h3 className="font-bold text-lg text-gym-text flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5 text-gym-primary" />
              Log Body Weight
            </h3>
            <p className="text-xs text-gym-muted">Log your body weight and metrics frequently to track fitness metrics.</p>

            <form onSubmit={handleLogProgress} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Body Weight (kg) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. 78.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Body Fat (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBodyFat}
                  onChange={(e) => setNewBodyFat(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. 14.5"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Muscle Mass (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newMuscleMass}
                  onChange={(e) => setNewMuscleMass(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. 36.2"
                />
              </div>
              <button
                type="submit"
                disabled={savingProgress}
                className="w-full py-3 bg-gym-primary hover:bg-gym-primary/80 text-black font-bold rounded-xl text-sm transition-all"
              >
                {savingProgress ? 'Saving...' : 'Add Log Record'}
              </button>
            </form>
          </div>

          {/* Logs List */}
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-lg text-gym-text">Weight History</h3>
            
            {progressLogs.length === 0 ? (
              <p className="text-sm text-gym-muted italic py-8 text-center">No progress logs recorded yet. Start tracking above!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-gym-muted font-bold">
                      <th className="py-2.5 pr-4">Log Date</th>
                      <th className="py-2.5 px-4 text-center">Weight</th>
                      <th className="py-2.5 px-4 text-center">Body Fat %</th>
                      <th className="py-2.5 px-4 text-center">Muscle Mass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900 font-medium">
                    {progressLogs.map((log) => (
                      <tr key={log.id} className="text-gym-text hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 pr-4">{new Date(log.loggedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-center font-bold text-gym-primary">{log.weightKg} kg</td>
                        <td className="py-3 px-4 text-center">{log.bodyFat ? `${log.bodyFat}%` : '-'}</td>
                        <td className="py-3 px-4 text-center">{log.muscleMass ? `${log.muscleMass} kg` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {portalTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Health Profile Card */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-gym-text flex items-center gap-2">
                <Heart className="h-5 w-5 text-gym-primary" />
                Medical & Contact Profile
              </h3>
              <p className="text-xs text-gym-muted mt-1">Keep your emergency contact details and physical health info up to date.</p>
            </div>

            {profileSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-bold">
                {profileSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo Upload Container */}
              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-2">Member Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border border-slate-800 bg-slate-900/60 overflow-hidden flex items-center justify-center shrink-0">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-gym-muted" />
                    )}
                  </div>
                  <div>
                    <label className="px-3 py-1.5 bg-slate-850 hover:bg-slate-800 text-gym-text text-xs font-bold rounded-lg border border-slate-800 cursor-pointer transition-all flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      Upload Picture
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-gym-muted mt-1">JPEG/PNG formats (Max 5MB). Photo displays at kiosk check-in validation.</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Emergency Contact Details (Name/Phone)</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. Jane Doe (+91 98765 43210)"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Medical History, Injuries or Allergies</label>
                <textarea
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  className="gym-input h-24 resize-none"
                  placeholder="List any medical alerts, surgical history, or physical injury conditions coaches should know..."
                />
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                className="w-full py-3 bg-gym-primary hover:bg-gym-primary/80 text-black font-bold rounded-xl text-sm transition-all"
              >
                {updatingProfile ? 'Saving Changes...' : 'Save Health Profile'}
              </button>
            </form>
          </div>

          {/* Trainer Feedback Card */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
            <div>
              <h3 className="font-extrabold text-lg text-gym-text flex items-center gap-2">
                <Star className="h-5 w-5 text-gym-secondary" />
                Submit Trainer Feedback
              </h3>
              <p className="text-xs text-gym-muted mt-1">Rate and comment on your assigned trainer performance.</p>
            </div>

            {feedbackSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-bold">
                {feedbackSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveFeedback} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Select Gym Trainer</label>
                <select
                  required
                  value={selectedTrainerId}
                  onChange={(e) => setSelectedTrainerId(e.target.value)}
                  className="gym-input"
                >
                  <option value="">-- Choose Coach --</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.specialty})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-2">Performance Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-7 w-7 ${
                          star <= feedbackRating
                            ? 'text-gym-secondary fill-gym-secondary'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted mb-1.5">Your Feedback Comment</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="gym-input h-24 resize-none"
                  placeholder="Share details of your personal workout training experience with this coach..."
                />
              </div>

              <button
                type="submit"
                disabled={submittingFeedback || !selectedTrainerId}
                className="w-full py-3 bg-gym-secondary hover:bg-gym-secondary/80 text-black font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingFeedback ? 'Submitting Review...' : 'Submit Coach Rating'}
              </button>
            </form>
          </div>
        </div>
      )}

      {portalTab === 'attendance' && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <div>
            <h3 className="font-bold text-lg text-gym-text">My Scan-in Attendance Logs</h3>
            <p className="text-xs text-gym-muted mt-1">Review check-in activity at the kiosk scanner counters.</p>
          </div>

          {attendance.length === 0 ? (
            <p className="text-sm text-gym-muted italic py-16 text-center">No attendance history found. Present your QR Pass at the desk kiosk.</p>
          ) : (
            <div className="divide-y divide-slate-800 max-h-[500px] overflow-y-auto pr-2">
              {attendance.map((log) => (
                <div key={log.id} className="py-3.5 flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                    <span className="text-gym-text font-bold">Kiosk Scan Check-in</span>
                  </div>
                  <span className="text-gym-muted font-mono text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

