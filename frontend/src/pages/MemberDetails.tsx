import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
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
  Sparkles,
  Snowflake,
  Sun,
  Plus,
  Trash2,
  Save,
  Dumbbell,
  Apple,
  Printer,
  Heart,
  User
} from 'lucide-react';

interface MemberDetailsData {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  joinDate: string;
  emergencyContact: string | null;
  medicalHistory: string | null;
  profilePhoto: string | null;
  trainerId: string | null;
  trainer: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string;
  } | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    branchId?: string | null;
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
      discount: number;
      status: 'PAID' | 'PENDING' | 'FAILED';
      method: string;
      paymentDate: string;
      isRefunded: boolean;
      refundedAmount: number;
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

import { printInvoice } from './MemberPortal.js';

export const MemberDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, branches } = useAuth();
  const [member, setMember] = useState<MemberDetailsData | null>(null);
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteMember = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this member? All subscriptions, payments, plans, check-ins, and logs will be deleted.')) {
      return;
    }

    try {
      await apiFetch(`/members/${id}`, {
        method: 'DELETE',
      });
      navigate('/members');
    } catch (err: any) {
      alert(err.message || 'Failed to delete member.');
    }
  };

  // Modals & Action States
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [freezeStartDate, setFreezeStartDate] = useState('');
  const [freezeEndDate, setFreezeEndDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [targetPaymentMaxAmount, setTargetPaymentMaxAmount] = useState<number>(0);

  const [showQRModal, setShowQRModal] = useState(false);
  const [checkInMsg, setCheckInMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Manual payment state
  const [manualPayModalOpen, setManualPayModalOpen] = useState(false);
  const [manualPayId, setManualPayId] = useState('');
  const [manualPayMethod, setManualPayMethod] = useState('CASH');
  const [manualPayDiscount, setManualPayDiscount] = useState('0');

  // Custom Tabs & Workout/Diet State
  const [activeTab, setActiveTab] = useState<'profile' | 'workout' | 'diet'>('profile');
  
  // Workout State
  const [workoutName, setWorkoutName] = useState('Custom Workout Plan');
  const [workoutDesc, setWorkoutDesc] = useState('');
  const [workoutDays, setWorkoutDays] = useState<Array<{ dayOfWeek: string; exercises: Array<{ name: string; sets: number; reps: string; weightLbs?: string; notes?: string }> }>>([]);

  // Diet State
  const [dietName, setDietName] = useState('Custom Diet Plan');
  const [dietDesc, setDietDesc] = useState('');
  const [dietMeals, setDietMeals] = useState<Array<{ name: string; time: string; items: string; calories?: string; protein?: string; carbs?: string; fat?: string }>>([]);

  const [savingWorkout, setSavingWorkout] = useState(false);
  const [savingDiet, setSavingDiet] = useState(false);

  // Profile Assignment Edit State
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [trainers, setTrainers] = useState<any[]>([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  const canEditPlans = user?.role === 'ADMIN' || (user?.role === 'TRAINER' && user?.trainer?.id === member?.trainerId);

  const fetchWorkoutAndDiet = async () => {
    try {
      const wData = await apiFetch<{ workoutPlan: any }>(`/members/${id}/workout`);
      if (wData.workoutPlan) {
        setWorkoutName(wData.workoutPlan.name || 'Custom Workout Plan');
        setWorkoutDesc(wData.workoutPlan.description || '');
        setWorkoutDays(wData.workoutPlan.days || []);
      } else {
        setWorkoutDays([
          { dayOfWeek: 'Monday', exercises: [{ name: '', sets: 3, reps: '10', weightLbs: '', notes: '' }] }
        ]);
      }

      const dData = await apiFetch<{ dietPlan: any }>(`/members/${id}/diet`);
      if (dData.dietPlan) {
        setDietName(dData.dietPlan.name || 'Custom Diet Plan');
        setDietDesc(dData.dietPlan.description || '');
        setDietMeals(dData.dietPlan.meals || []);
      } else {
        setDietMeals([
          { name: 'Breakfast', time: '08:00 AM', items: '', calories: '', protein: '', carbs: '', fat: '' }
        ]);
      }
    } catch (err) {
      console.error('Error fetching workout/diet:', err);
    }
  };

  const handleSaveWorkout = async () => {
    try {
      setSavingWorkout(true);
      await apiFetch(`/members/${id}/workout`, {
        method: 'POST',
        body: { name: workoutName, description: workoutDesc, days: workoutDays },
      });
      alert('Workout plan saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save workout plan');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleSaveDiet = async () => {
    try {
      setSavingDiet(true);
      await apiFetch(`/members/${id}/diet`, {
        method: 'POST',
        body: { name: dietName, description: dietDesc, meals: dietMeals },
      });
      alert('Diet plan saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save diet plan');
    } finally {
      setSavingDiet(false);
    }
  };

  const handleDeleteWorkout = async () => {
    if (!window.confirm('Are you sure you want to delete this workout plan?')) return;
    try {
      setSavingWorkout(true);
      await apiFetch(`/members/${id}/workout`, {
        method: 'DELETE',
      });
      setWorkoutName('Custom Workout Plan');
      setWorkoutDesc('');
      setWorkoutDays([]);
      alert('Workout plan deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete workout plan');
    } finally {
      setSavingWorkout(false);
    }
  };

  const handleDeleteDiet = async () => {
    if (!window.confirm('Are you sure you want to delete this diet plan?')) return;
    try {
      setSavingDiet(true);
      await apiFetch(`/members/${id}/diet`, {
        method: 'DELETE',
      });
      setDietName('Custom Diet Plan');
      setDietDesc('');
      setDietMeals([]);
      alert('Diet plan deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete diet plan');
    } finally {
      setSavingDiet(false);
    }
  };

  const fetchMemberDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ member: MemberDetailsData }>(`/members/${id}`);
      setMember(data.member);
      setSelectedBranchId(data.member.user.branchId || '');
      setSelectedTrainerId(data.member.trainerId || '');
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
    fetchWorkoutAndDiet();
  }, [id]);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const branchIdToUse = selectedBranchId || member?.user?.branchId;
        const url = branchIdToUse ? `/trainers?branchId=${branchIdToUse}` : '/trainers';
        const data = await apiFetch<{ trainers: any[] }>(url);
        setTrainers(data.trainers || []);
      } catch (err: any) {
        console.error('Failed to load trainers:', err);
      }
    };
    if (member) {
      fetchTrainers();
    }
  }, [selectedBranchId, member?.user?.branchId]);

  const handleSaveAssignments = async () => {
    try {
      setSavingAssignments(true);
      await apiFetch(`/members/${id}/profile`, {
        method: 'PUT',
        body: {
          branchId: selectedBranchId || null,
          trainerId: selectedTrainerId || null,
        },
      });
      alert('Assignments updated successfully!');
      await fetchMemberDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to save assignments.');
    } finally {
      setSavingAssignments(false);
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

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeStartDate || !freezeEndDate) return;

    setActionLoading(true);
    try {
      await apiFetch(`/members/${id}/freeze`, {
        method: 'POST',
        body: { startDate: freezeStartDate, endDate: freezeEndDate },
      });
      setFreezeModalOpen(false);
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to freeze membership.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!window.confirm('Are you sure you want to unfreeze this membership?')) return;

    setActionLoading(true);
    try {
      await apiFetch(`/members/${id}/unfreeze`, {
        method: 'POST',
      });
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to unfreeze membership.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgradeDowngrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;

    setActionLoading(true);
    try {
      await apiFetch(`/members/${id}/upgrade-downgrade`, {
        method: 'POST',
        body: { planId: selectedPlanId },
      });
      setUpgradeModalOpen(false);
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to change membership package.');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerRefund = (paymentId: string, maxAmount: number) => {
    setRefundPaymentId(paymentId);
    setTargetPaymentMaxAmount(maxAmount);
    setRefundAmount(maxAmount.toString());
    setRefundModalOpen(true);
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundAmount) return;

    setActionLoading(true);
    try {
      await apiFetch(`/payments/${refundPaymentId}/refund`, {
        method: 'POST',
        body: { amount: parseFloat(refundAmount) },
      });
      setRefundModalOpen(false);
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to process refund.');
    } finally {
      setActionLoading(false);
    }
  };

  const triggerManualPayment = (paymentId: string) => {
    setManualPayId(paymentId);
    setManualPayMethod('CASH');
    setManualPayDiscount('0');
    setManualPayModalOpen(true);
  };

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await apiFetch(`/payments/${manualPayId}/manual`, {
        method: 'POST',
        body: { method: manualPayMethod, discount: parseFloat(manualPayDiscount) },
      });
      setManualPayModalOpen(false);
      await fetchMemberDetails();
    } catch (err: any) {
      setError(err.message || 'Failed to log manual payment.');
    } finally {
      setActionLoading(false);
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
            Paused / Frozen
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
      <div className="flex h-[60vh] items-center justify-center">
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
            <div className="h-24 w-24 rounded-full border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center mb-4 shrink-0">
              {member.profilePhoto ? (
                <img src={member.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="text-gym-primary font-bold text-3xl">
                  {member.user.firstName[0]}{member.user.lastName[0]}
                </div>
              )}
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
              <div className="flex items-center gap-3 text-sm text-gym-muted">
                <User className="h-5 w-5 text-gym-primary shrink-0" />
                <span>Trainer: {member.trainer ? `${member.trainer.firstName} ${member.trainer.lastName}` : 'No Trainer Assigned'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gym-muted">
                <Sparkles className="h-5 w-5 text-gym-primary shrink-0" />
                <span>Branch: {member.user.branchId ? (branches.find((b: any) => b.id === member.user.branchId)?.name || 'Home Branch') : 'Global / Not assigned'}</span>
              </div>
              {member.medicalHistory && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2">
                  <Heart className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Medical Details:</p>
                    <p className="mt-0.5 leading-relaxed font-semibold">{member.medicalHistory}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Membership Actions Panel */}
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-gym-primary" />
              Membership Actions
            </h3>

            <div className="space-y-3 pt-2">
              {member.status === 'ACTIVE' ? (
                <button
                  onClick={() => setFreezeModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black font-semibold rounded-xl transition-all"
                >
                  <Snowflake className="h-5 w-5" />
                  Freeze Membership
                </button>
              ) : member.status === 'PAUSED' ? (
                <button
                  onClick={handleUnfreeze}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold rounded-xl transition-all"
                >
                  <Sun className="h-5 w-5" />
                  Unfreeze Membership
                </button>
              ) : null}

              {activeSub && (
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gym-primary/10 text-gym-primary hover:bg-gym-primary hover:text-black font-semibold rounded-xl transition-all"
                >
                  <Sparkles className="h-5 w-5" />
                  Upgrade / Change Package
                </button>
              )}
              
              {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                <button
                  onClick={handleDeleteMember}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 font-semibold rounded-xl transition-all"
                >
                  <Trash2 className="h-5 w-5" />
                  Delete Member Profile
                </button>
              )}
            </div>
          </div>

          {/* Member Profile Assignments (Only visible to Admin or Staff) */}
          {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
            <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-gym-primary" />
                Profile Assignments
              </h3>

              <div className="space-y-4 pt-2">
                {/* Branch assignment - only Admin can edit */}
                {user?.role === 'ADMIN' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Assign Branch</label>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="gym-input text-xs"
                    >
                      <option value="">No Specific Branch (Global)</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-1">Branch</span>
                    <p className="text-sm font-semibold text-gym-text">
                      {member.user.branchId ? (branches.find((b: any) => b.id === member.user.branchId)?.name || 'Home Branch') : 'Global / Not assigned'}
                    </p>
                  </div>
                )}

                {/* Trainer assignment - Admin or Staff can edit */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Assign Personal Trainer</label>
                  <select
                    value={selectedTrainerId}
                    onChange={(e) => setSelectedTrainerId(e.target.value)}
                    className="gym-input text-xs"
                  >
                    <option value="">No Personal Trainer (General Plan)</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName} ({t.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSaveAssignments}
                  disabled={savingAssignments}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gym-primary text-black font-bold text-xs rounded-xl hover:opacity-90 transition-all shadow-md shadow-gym-primary/20"
                >
                  <Save className="h-4 w-4" />
                  {savingAssignments ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Active Plan, Billing & Check-in logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 gap-6 mb-2">
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 ${
                activeTab === 'profile'
                  ? 'border-gym-primary text-gym-primary'
                  : 'border-transparent text-gym-muted hover:text-gym-text'
              }`}
            >
              Member Profile
            </button>
            <button
              onClick={() => setActiveTab('workout')}
              className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 ${
                activeTab === 'workout'
                  ? 'border-gym-primary text-gym-primary'
                  : 'border-transparent text-gym-muted hover:text-gym-text'
              }`}
            >
              Workout Plan
            </button>
            <button
              onClick={() => setActiveTab('diet')}
              className={`pb-3 font-bold text-sm tracking-wide transition-all border-b-2 ${
                activeTab === 'diet'
                  ? 'border-gym-primary text-gym-primary'
                  : 'border-transparent text-gym-muted hover:text-gym-text'
              }`}
            >
              Diet Plan
            </button>
          </div>

          {activeTab === 'profile' && (
            <>
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
                      <p className="text-2xl font-extrabold text-gym-primary">₹{activeSub.plan.price.toFixed(2)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 border border-dashed border-slate-200 rounded-xl text-gym-muted text-sm">
                    No active membership plan currently. Assign a new plan below.
                  </div>
                )}

                {/* Form to Assign New Plan */}
                {!activeSub && plans.length > 0 && (
                  <form onSubmit={handleUpgradeDowngrade} className="mt-6 border-t border-slate-100 pt-6 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Assign Package</label>
                      <select
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="gym-input"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} - ₹{p.price.toFixed(2)} ({p.durationMonths} {p.durationMonths === 1 ? 'Month' : 'Months'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-6 py-3 bg-gradient-premium text-black font-bold rounded-xl text-sm transition-all hover:opacity-90 whitespace-nowrap transform active:scale-95 shadow-md shadow-gym-primary/25"
                    >
                      {actionLoading ? 'Assigning...' : 'Assign Package'}
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
                      <div key={sub.id} className="border border-slate-800 rounded-xl p-4 bg-gym-darker/20 space-y-3">
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
                              : 'bg-slate-800 text-gym-muted border border-slate-700'
                          }`}>
                            {sub.status}
                          </span>
                        </div>

                        {/* Associated Payments */}
                        <div className="border-t border-slate-800 pt-3 space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gym-muted">Payments</p>
                          {sub.payments.map((pmt) => (
                            <div key={pmt.id} className="flex justify-between items-center text-xs text-gym-muted">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {pmt.paymentDate ? new Date(pmt.paymentDate).toLocaleDateString() : 'Pending'} - {pmt.method}
                                {pmt.discount > 0 && <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">(Disc: ₹{pmt.discount})</span>}
                                {pmt.isRefunded && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">(Refunded: ₹{pmt.refundedAmount})</span>}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-gym-text">₹{pmt.amount.toFixed(2)}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  pmt.status === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : pmt.status === 'PENDING'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {pmt.status}
                                </span>
                                {pmt.status === 'PENDING' && (
                                  <button
                                    onClick={() => triggerManualPayment(pmt.id)}
                                    className="px-2 py-1 bg-gym-primary text-black font-bold rounded text-[10px] hover:bg-gym-primary-hover transition-all"
                                  >
                                    Pay Now
                                  </button>
                                )}
                                {pmt.status === 'PAID' && !pmt.isRefunded && (
                                  <button
                                    onClick={() => triggerRefund(pmt.id, pmt.amount)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded transition-all text-[10px]"
                                  >
                                    Refund
                                  </button>
                                )}
                                {pmt.status === 'PAID' && (
                                  <button
                                    onClick={() => printInvoice(
                                      pmt,
                                      `${member.user.firstName} ${member.user.lastName}`,
                                      sub.plan.name,
                                      'Main Gym Branch'
                                    )}
                                    className="p-1 hover:bg-slate-800 text-gym-muted hover:text-gym-text rounded transition-all ml-1"
                                    title="Print Invoice Receipt"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                )}
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
                  <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto pr-2">
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
            </>
          )}

          {activeTab === 'workout' && (
            <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-gym-text flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-gym-primary" />
                    Configure Workout Plan
                  </h3>
                  <p className="text-xs text-gym-muted mt-1">Design a custom training program for {member.user.firstName}.</p>
                </div>
                {canEditPlans && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteWorkout}
                      disabled={savingWorkout}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 font-bold text-xs rounded-xl transition-all border border-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Plan
                    </button>
                    <button
                      onClick={handleSaveWorkout}
                      disabled={savingWorkout}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gym-primary text-black font-bold text-xs rounded-xl hover:opacity-90 transition-all shadow-md shadow-gym-primary/20"
                    >
                      <Save className="h-4 w-4" />
                      {savingWorkout ? 'Saving...' : 'Save Workout'}
                    </button>
                  </div>
                )}
              </div>

              {!canEditPlans && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-4 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Read-only: You are not assigned as this member's Personal Trainer. Only the Admin can manage general plans, and only the assigned PT can manage PT-specific plans.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Plan Title</label>
                  <input
                    type="text"
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                    disabled={!canEditPlans}
                    className="gym-input"
                    placeholder="e.g. Strength Training, Weight Loss Split"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Description / Instructions</label>
                  <input
                    type="text"
                    value={workoutDesc}
                    onChange={(e) => setWorkoutDesc(e.target.value)}
                    disabled={!canEditPlans}
                    className="gym-input"
                    placeholder="e.g. Hydrate well, rest 90s between sets"
                  />
                </div>
              </div>

              {/* Days List */}
              <div className="space-y-6">
                {workoutDays.map((day, dIdx) => (
                  <div key={dIdx} className="border border-slate-850 rounded-2xl p-5 bg-slate-950/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gym-primary bg-gym-primary/10 px-2.5 py-1 rounded-lg">Day {dIdx + 1}</span>
                        <input
                          type="text"
                          value={day.dayOfWeek}
                          onChange={(e) => {
                            const newDays = [...workoutDays];
                            newDays[dIdx].dayOfWeek = e.target.value;
                            setWorkoutDays(newDays);
                          }}
                          disabled={!canEditPlans}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-gym-primary focus:outline-none font-bold text-gym-text text-sm px-1 py-0.5"
                          placeholder="e.g. Monday (Chest)"
                        />
                      </div>
                      {canEditPlans && (
                        <button
                          onClick={() => {
                            const newDays = workoutDays.filter((_, idx) => idx !== dIdx);
                            setWorkoutDays(newDays);
                          }}
                          className="text-red-400 hover:text-red-500 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="h-4 w-4" /> Remove Day
                        </button>
                      )}
                    </div>

                    {/* Exercises */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-12 gap-3 text-xs font-bold text-gym-muted px-1">
                        <div className="col-span-4">Exercise Name</div>
                        <div className="col-span-2">Sets</div>
                        <div className="col-span-3">Reps</div>
                        <div className="col-span-2">Weight (lbs)</div>
                        {canEditPlans && <div className="col-span-1">Action</div>}
                      </div>

                      {day.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="grid grid-cols-12 gap-3 items-center">
                          <div className={canEditPlans ? "col-span-4" : "col-span-5"}>
                            <input
                              type="text"
                              value={ex.name}
                              onChange={(e) => {
                                const newDays = [...workoutDays];
                                newDays[dIdx].exercises[eIdx].name = e.target.value;
                                setWorkoutDays(newDays);
                              }}
                              disabled={!canEditPlans}
                              className="gym-input-sm"
                              placeholder="Bench Press, Squats..."
                              required
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={ex.sets}
                              onChange={(e) => {
                                const newDays = [...workoutDays];
                                newDays[dIdx].exercises[eIdx].sets = parseInt(e.target.value) || 0;
                                setWorkoutDays(newDays);
                              }}
                              disabled={!canEditPlans}
                              className="gym-input-sm"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="text"
                              value={ex.reps}
                              onChange={(e) => {
                                const newDays = [...workoutDays];
                                newDays[dIdx].exercises[eIdx].reps = e.target.value;
                                setWorkoutDays(newDays);
                              }}
                              disabled={!canEditPlans}
                              className="gym-input-sm"
                              placeholder="10, 8, 6"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              value={ex.weightLbs || ''}
                              onChange={(e) => {
                                const newDays = [...workoutDays];
                                newDays[dIdx].exercises[eIdx].weightLbs = e.target.value;
                                setWorkoutDays(newDays);
                              }}
                              disabled={!canEditPlans}
                              className="gym-input-sm"
                              placeholder="135"
                            />
                          </div>
                          {canEditPlans && (
                            <div className="col-span-1 flex justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const newDays = [...workoutDays];
                                  newDays[dIdx].exercises = newDays[dIdx].exercises.filter((_, idx) => idx !== eIdx);
                                  setWorkoutDays(newDays);
                                }}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {canEditPlans && (
                        <button
                          type="button"
                          onClick={() => {
                            const newDays = [...workoutDays];
                            newDays[dIdx].exercises.push({ name: '', sets: 3, reps: '10', weightLbs: '', notes: '' });
                            setWorkoutDays(newDays);
                          }}
                          className="mt-2 text-xs font-bold text-gym-primary hover:underline flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Exercise
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {canEditPlans && (
                  <button
                    type="button"
                    onClick={() => {
                      setWorkoutDays([...workoutDays, { dayOfWeek: 'New Day', exercises: [] }]);
                    }}
                    className="w-full py-3 border border-dashed border-slate-800 hover:border-gym-primary/50 text-gym-muted hover:text-gym-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add Training Day
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'diet' && (
            <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-extrabold text-lg text-gym-text flex items-center gap-2">
                    <Apple className="h-5 w-5 text-gym-secondary" />
                    Configure Diet & Nutrition Plan
                  </h3>
                  <p className="text-xs text-gym-muted mt-1">Design a customized nutrition plan for {member.user.firstName}.</p>
                </div>
                {canEditPlans && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteDiet}
                      disabled={savingDiet}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 font-bold text-xs rounded-xl transition-all border border-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Plan
                    </button>
                    <button
                      onClick={handleSaveDiet}
                      disabled={savingDiet}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gym-primary text-black font-bold text-xs rounded-xl hover:opacity-90 transition-all shadow-md shadow-gym-primary/20"
                    >
                      <Save className="h-4 w-4" />
                      {savingDiet ? 'Saving...' : 'Save Diet'}
                    </button>
                  </div>
                )}
              </div>

              {!canEditPlans && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl p-4 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>Read-only: You are not assigned as this member's Personal Trainer. Only the Admin can manage general plans, and only the assigned PT can manage PT-specific plans.</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Diet Title</label>
                  <input
                    type="text"
                    value={dietName}
                    onChange={(e) => setDietName(e.target.value)}
                    disabled={!canEditPlans}
                    className="gym-input"
                    placeholder="e.g. Clean Bulking, High Protein Lean Cut"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">Instructions / Target Calories</label>
                  <input
                    type="text"
                    value={dietDesc}
                    onChange={(e) => setDietDesc(e.target.value)}
                    disabled={!canEditPlans}
                    className="gym-input"
                    placeholder="e.g. Target 2,500 kcal, Drink 4L water daily"
                  />
                </div>
              </div>

              {/* Meals List */}
              <div className="space-y-4">
                <div className="grid grid-cols-12 gap-3 text-xs font-bold text-gym-muted px-1">
                  <div className="col-span-2">Meal Name</div>
                  <div className="col-span-2">Time</div>
                  <div className="col-span-4">Food Items / Ingredients</div>
                  <div className="col-span-1 text-center">Calories</div>
                  <div className="col-span-1 text-center">Pro (g)</div>
                  <div className={canEditPlans ? "col-span-1 text-center" : "col-span-2 text-center"}>Carbs (g)</div>
                  {canEditPlans && <div className="col-span-1 text-center">Action</div>}
                </div>

                {dietMeals.map((meal, mIdx) => (
                  <div key={mIdx} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={meal.name}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].name = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm"
                        placeholder="e.g. Breakfast"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={meal.time || ''}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].time = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm"
                        placeholder="08:00 AM"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={meal.items}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].items = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm"
                        placeholder="4 egg whites, oatmeal..."
                        required
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={meal.calories || ''}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].calories = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm text-center"
                        placeholder="450"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={meal.protein || ''}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].protein = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm text-center"
                        placeholder="30"
                      />
                    </div>
                    <div className={canEditPlans ? "col-span-1" : "col-span-2"}>
                      <input
                        type="number"
                        value={meal.carbs || ''}
                        onChange={(e) => {
                          const newMeals = [...dietMeals];
                          newMeals[mIdx].carbs = e.target.value;
                          setDietMeals(newMeals);
                        }}
                        disabled={!canEditPlans}
                        className="gym-input-sm text-center"
                        placeholder="45"
                      />
                    </div>
                    {canEditPlans && (
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => {
                            const newMeals = dietMeals.filter((_, idx) => idx !== mIdx);
                            setDietMeals(newMeals);
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg w-full flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {canEditPlans && (
                  <button
                    type="button"
                    onClick={() => {
                      setDietMeals([...dietMeals, { name: '', time: '', items: '', calories: '', protein: '', carbs: '', fat: '' }]);
                    }}
                    className="w-full py-3 border border-dashed border-slate-800 hover:border-gym-primary/50 text-gym-muted hover:text-gym-primary rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add Meal Option
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* FREEZE MEMBERSHIP MODAL */}
      {freezeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-gym-text">Freeze Membership</h2>
            </div>
            <form onSubmit={handleFreeze} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={freezeStartDate}
                  onChange={(e) => setFreezeStartDate(e.target.value)}
                  className="gym-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">End Date</label>
                <input
                  type="date"
                  value={freezeEndDate}
                  onChange={(e) => setFreezeEndDate(e.target.value)}
                  className="gym-input"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setFreezeModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-850 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-xl transition-all"
                >
                  {actionLoading ? 'Freezing...' : 'Freeze Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPGRADE / CHANGE PLAN MODAL */}
      {upgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-gym-text">Upgrade / Change Package</h2>
            </div>
            <form onSubmit={handleUpgradeDowngrade} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">Select New Package</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="gym-input"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - ₹{p.price.toFixed(2)} ({p.durationMonths} months)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-850 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-xl transition-all"
                >
                  {actionLoading ? 'Upgrading...' : 'Confirm Upgrade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REFUND MODAL */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-gym-text">Process Refund</h2>
            </div>
            <form onSubmit={handleRefund} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">Refund Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  max={targetPaymentMaxAmount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="gym-input font-mono"
                  required
                />
                <p className="text-xs text-gym-muted mt-1.5">Max allowed refund: ₹{targetPaymentMaxAmount}</p>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setRefundModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-850 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL PAYMENT WITH DISCOUNT MODAL */}
      {manualPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-xl font-bold text-gym-text">Record Payment</h2>
            </div>
            <form onSubmit={handleManualPaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">Payment Method</label>
                <select
                  value={manualPayMethod}
                  onChange={(e) => setManualPayMethod(e.target.value)}
                  className="gym-input"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">Discount Given (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualPayDiscount}
                  onChange={(e) => setManualPayDiscount(e.target.value)}
                  className="gym-input font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setManualPayModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-850 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-xl transition-all"
                >
                  {actionLoading ? 'Logging...' : 'Submit Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIGITAL PASS QR MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-sm w-full p-6 rounded-3xl border border-white/15 relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-gym-secondary/15 blur-[40px] pointer-events-none" />
            <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 rounded-full bg-gym-primary/15 blur-[40px] pointer-events-none" />

            <button
              onClick={() => setShowQRModal(false)}
              className="absolute right-4 top-4 text-gym-muted hover:text-gym-text transition-colors"
            >
              <ArrowLeft className="h-5 w-5 rotate-90" />
            </button>

            <div className="text-center mt-2 mb-6">
              <span className="text-[10px] uppercase font-bold tracking-widest text-gym-primary">Gymnasium Club</span>
              <h3 className="text-lg font-black text-gym-text mt-1">MEMBERSHIP ACCESS</h3>
            </div>

            <div className="w-full bg-gym-card/60 rounded-2xl p-5 border border-slate-200 flex flex-col items-center space-y-4 shadow-xl">
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

              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&color=0f172a&data=${member.id}`}
                  alt="Member QR Code badge pass"
                  className="w-40 h-40 object-contain"
                />
              </div>

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
