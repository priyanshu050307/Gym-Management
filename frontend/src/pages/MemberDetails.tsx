import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import {
  ArrowLeft,
  Calendar,
  Phone,
  Settings,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

interface MemberDetailsData {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  joinDate: string;
  emergencyContact: string | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  subscriptions: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    plan: {
      name: string;
      price: number;
    };
    payments: Array<{
      id: string;
      amount: number;
      status: 'PAID' | 'PENDING' | 'FAILED';
      method: string;
      paymentDate: string;
    }>;
  }>;
  checkIns: Array<{
    id: string;
    timestamp: string;
  }>;
}

interface PlanData {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
}

export const MemberDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<MemberDetailsData | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [status, setStatus] = useState<string>('ACTIVE');
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  const fetchMemberDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ member: MemberDetailsData }>(`/members/${id}`);
      setMember(data.member);
      setStatus(data.member.status);
      setEmergencyContact(data.member.emergencyContact || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load member profile.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await apiFetch<{ plans: PlanData[] }>('/plans');
      setPlans(data.plans);
      if (data.plans.length > 0) setSelectedPlanId(data.plans[0].id);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  };

  useEffect(() => {
    fetchMemberDetails();
    fetchPlans();
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    try {
      await apiFetch(`/members/${id}/status`, {
        method: 'PUT',
        body: { status, emergencyContact },
      });
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to update member details.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    setAddingSub(true);
    try {
      await apiFetch(`/members/${id}/subscription`, {
        method: 'POST',
        body: { planId: selectedPlanId },
      });
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to add subscription.');
    } finally {
      setAddingSub(false);
    }
  };

  const handleManualCheckIn = async () => {
    setCheckInMsg(null);
    try {
      const res = await apiFetch(`/members/${id}/checkin`, {
        method: 'POST',
      });
      setCheckInMsg({ type: 'success', text: res.message });
      await fetchMemberDetails();
    } catch (err: any) {
      setCheckInMsg({ type: 'error', text: err.message || 'Access Denied.' });
    }
  };

  const getStatusBadge = (mStatus: string) => {
    switch (mStatus) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4" />
            Active
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4" />
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="h-4 w-4" />
            Inactive
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-6">
        <Link to="/members" className="inline-flex items-center gap-2 text-gym-muted hover:text-gym-text transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
        <div className="p-6 text-center text-gym-muted glass-card rounded-2xl border border-slate-100">
          Member profile not found.
        </div>
      </div>
    );
  }

  const activeSub = member.subscriptions.find((sub) => sub.status === 'ACTIVE');

  return (
    <div className="space-y-8">
      {/* Back Link & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link to="/members" className="inline-flex items-center gap-2 text-gym-muted hover:text-gym-text transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowQRModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gym-secondary/10 text-gym-secondary border border-gym-secondary/20 rounded-xl hover:bg-gym-secondary hover:text-white transition-all font-semibold"
          >
            <QrCode className="h-5 w-5" />
            Digital Pass QR
          </button>
          <button
            onClick={handleManualCheckIn}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-xl hover:bg-gym-primary hover:text-white transition-all font-semibold"
          >
            <QrCode className="h-5 w-5" />
            Log Manual Check-In
          </button>
        </div>
      </div>

      {checkInMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
            checkInMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          {checkInMsg.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span>{checkInMsg.text}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Profile Info & Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Summary & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-gym-primary/20 flex items-center justify-center mb-4 border border-gym-primary/30 text-gym-primary font-bold text-3xl">
              {member.user.firstName[0]}{member.user.lastName[0]}
            </div>
            <h2 className="text-xl font-bold">{member.user.firstName} {member.user.lastName}</h2>
            <p className="text-gym-muted text-sm mt-1">{member.user.email}</p>
            <div className="mt-4">{getStatusBadge(member.status)}</div>

            <div className="w-full mt-6 border-t border-slate-100 pt-6 space-y-4 text-left">
              <div className="flex items-center gap-3 text-sm text-gym-muted">
                <Calendar className="h-5 w-5 text-gym-primary shrink-0" />
                <span>Joined {new Date(member.joinDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gym-muted">
                <Phone className="h-5 w-5 text-gym-primary shrink-0" />
                <span>Emergency: {member.emergencyContact || 'Not provided'}</span>
              </div>
            </div>
          </div>

          {/* Quick Edit Status Form */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-gym-primary" />
              Update Account Status
            </h3>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Member Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:outline-none focus:border-gym-primary transition-all text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Emergency Contact</label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Contact details"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:outline-none focus:border-gym-primary transition-all text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full py-2.5 bg-gym-primary text-white font-semibold rounded-xl text-sm transition-all hover:bg-gym-primary/80"
              >
                {updating ? 'Saving...' : 'Save Profile Details'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Active Plan, Billing & Check-in logs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Plan details */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4 text-gym-primary">
              <Sparkles className="h-5 w-5" />
              Active Subscription
            </h3>

            {activeSub ? (
              <div className="bg-gym-primary/10 border border-gym-primary/20 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-xl font-bold text-white">{activeSub.plan.name}</h4>
                  <p className="text-gym-muted text-sm mt-1">
                    Validity: {new Date(activeSub.startDate).toLocaleDateString()} to {new Date(activeSub.endDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-gym-muted">Price</span>
                  <p className="text-2xl font-extrabold text-gym-primary">${activeSub.plan.price.toFixed(2)}</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl text-gym-muted text-sm">
                No active membership plan currently. Assign a new plan below.
              </div>
            )}

            {/* Form to Assign New Plan */}
            {!activeSub && plans.length > 0 && (
              <form onSubmit={handleAddSubscription} className="mt-6 border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Assign Package</label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:outline-none focus:border-gym-primary transition-all text-sm"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - ${p.price.toFixed(2)} ({p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={addingSub}
                  className="px-6 py-3 bg-gradient-premium text-white font-semibold rounded-xl text-sm transition-all hover:opacity-90 whitespace-nowrap transform active:scale-95"
                >
                  {addingSub ? 'Assigning...' : 'Assign Package'}
                </button>
              </form>
            )}
          </div>

          {/* Subscriptions & Invoicing History */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-gym-primary" />
              Billing & Subscription Logs
            </h3>

            {member.subscriptions.length === 0 ? (
              <p className="text-sm text-gym-muted italic py-2">No billing records found.</p>
            ) : (
              <div className="space-y-4">
                {member.subscriptions.map((sub) => (
                  <div key={sub.id} className="border border-slate-100 rounded-xl p-4 bg-gym-darker/20 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-gym-text">{sub.plan.name}</h4>
                        <p className="text-xs text-gym-muted">
                          {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        sub.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-100 text-gym-muted border border-slate-100'
                      }`}>
                        {sub.status}
                      </span>
                    </div>

                    {/* Associated Payments */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gym-muted">Payments</p>
                      {sub.payments.map((pmt) => (
                        <div key={pmt.id} className="flex justify-between items-center text-xs text-gym-muted">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(pmt.paymentDate).toLocaleDateString()} - {pmt.method}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gym-text">${pmt.amount.toFixed(2)}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pmt.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : pmt.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              {pmt.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Check-In Logs */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-gym-primary" />
              Recent Check-In Logs (Last 10)
            </h3>

            {member.checkIns.length === 0 ? (
              <p className="text-sm text-gym-muted italic py-4">No check-in history found for this member.</p>
            ) : (
              <div className="divide-y divide-slate-200 max-h-64 overflow-y-auto pr-2">
                {member.checkIns.slice(0, 10).map((log) => (
                  <div key={log.id} className="py-3 flex justify-between items-center text-sm">
                    <span className="text-gym-text font-medium">Checked In</span>
                    <span className="text-gym-muted text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* DIGITAL PASS QR MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-sm w-full p-6 rounded-3xl border border-white/15 relative overflow-hidden flex flex-col items-center">
            {/* Visual background accents */}
            <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-gym-secondary/15 blur-[40px] pointer-events-none" />
            <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 rounded-full bg-gym-primary/15 blur-[40px] pointer-events-none" />

            <button
              onClick={() => setShowQRModal(false)}
              className="absolute right-4 top-4 text-gym-muted hover:text-gym-text transition-colors"
            >
              <ArrowLeft className="h-5 w-5 rotate-90" />
            </button>

            {/* Pass Header */}
            <div className="text-center mt-2 mb-6">
              <span className="text-[10px] uppercase font-bold tracking-widest text-gym-primary">Gymnasium Club</span>
              <h3 className="text-lg font-black text-gym-text mt-1">MEMBERSHIP ACCESS</h3>
            </div>

            {/* Pass Body (Wallet card visual) */}
            <div className="w-full bg-gym-card/60 rounded-2xl p-5 border border-slate-200 flex flex-col items-center space-y-4 shadow-xl">
              {/* Member Card Details */}
              <div className="flex items-center gap-3 w-full border-b border-slate-100 pb-3">
                <div className="h-10 w-10 rounded-full bg-gym-secondary/20 flex items-center justify-center border border-gym-secondary/30 text-gym-secondary font-bold text-sm">
                  {member.user.firstName[0]}{member.user.lastName[0]}
                </div>
                <div className="text-left truncate">
                  <div className="font-extrabold text-sm text-gym-text truncate">
                    {member.user.firstName} {member.user.lastName}
                  </div>
                  <div className="text-[10px] text-gym-muted">
                    Joined: {new Date(member.joinDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="w-full flex justify-between items-center text-xs">
                <span className="text-gym-muted">Membership Status</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  member.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {member.status}
                </span>
              </div>

              {/* QR Image Frame */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=0f172a&data=${member.id}`}
                  alt="Member QR Code badge pass"
                  className="w-40 h-40 object-contain"
                />
              </div>

              {/* Monospace Badge Code */}
              <div className="text-center space-y-1">
                <div className="font-mono text-[9px] tracking-wider text-gym-muted">
                  {member.id.toUpperCase()}
                </div>
                <div className="text-[8px] text-gym-primary font-semibold uppercase tracking-widest">
                  Hold close to camera to scan
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-100 text-gym-text border border-slate-200 font-bold rounded-xl text-xs transition-all"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
