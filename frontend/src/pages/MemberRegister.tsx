import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { ArrowLeft, User, Mail, ShieldAlert, Phone, Sparkles } from 'lucide-react';

interface PlanData {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
}

export const MemberRegister: React.FC = () => {
  const navigate = useNavigate();
  const { user, branches, activeBranchId } = useAuth();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [planId, setPlanId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [trainers, setTrainers] = useState<any[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');

  useEffect(() => {
    if (user?.role === 'STAFF' && user.branchId) {
      setSelectedBranchId(user.branchId);
    } else if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [user, activeBranchId]);

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const url = selectedBranchId ? `/trainers?branchId=${selectedBranchId}` : '/trainers';
        const data = await apiFetch<{ trainers: any[] }>(url);
        setTrainers(data.trainers || []);
      } catch (err: any) {
        console.error('Failed to load trainers:', err);
      }
    };
    fetchTrainers();
  }, [selectedBranchId]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await apiFetch<{ plans: PlanData[] }>('/plans');
        setPlans(data.plans);
        if (data.plans.length > 0) {
          setPlanId(data.plans[0].id); // Select first plan by default
        }
      } catch (err: any) {
        console.error('Failed to load plans:', err);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (emergencyContact && !/^\d{10}$/.test(emergencyContact)) {
      setError('Emergency contact must be exactly 10 digits.');
      return;
    }

    if (email && !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoadingSubmit(true);

    try {
      await apiFetch('/members/register', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          email,
          password,
          emergencyContact,
          planId: planId || undefined,
          branchId: selectedBranchId || undefined,
          trainerId: selectedTrainerId || undefined,
        },
      });

      navigate('/members');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back link */}
      <Link to="/members" className="inline-flex items-center gap-2 text-gym-muted hover:text-gym-text transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Members Directory
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Register New Member</h1>
        <p className="text-gym-muted mt-1">Create a new member account and assign an initial membership plan.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Details */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gym-primary">
            <User className="h-5 w-5" />
            Personal Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="gym-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="gym-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gym-text/80 mb-2">Emergency Contact Number</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gym-muted" />
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="gym-input pl-12 pr-4"
              />
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gym-primary">
            <Mail className="h-5 w-5" />
            Account Credentials
          </h2>

          <div>
            <label className="block text-sm font-medium text-gym-text/80 mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john.doe@gmail.com"
              className="gym-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gym-text/80 mb-2">Temporary Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="gym-input"
            />
            <p className="text-xs text-gym-muted mt-1">The member can change this password upon their first login.</p>
          </div>
        </div>

        {/* Membership Assignment */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gym-primary">
            <Sparkles className="h-5 w-5" />
            Assign Membership Plan
          </h2>

          {loadingPlans ? (
            <div className="py-4 text-center text-gym-muted">Loading membership plans...</div>
          ) : plans.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-start gap-3 text-sm">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>
                No membership plans exist. You must create a membership plan in settings before registering a member with an active subscription.
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Select Package</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="gym-input"
              >
                <option value="">No Active Plan (Register Only)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ₹{p.price.toFixed(2)} ({p.durationMonths === 0 ? '1 Day Trial' : `${p.durationMonths} ${p.durationMonths === 1 ? 'Month' : 'Months'}`})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Personal Trainer Assignment (Visible to Admin and Staff) */}
        {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gym-primary">
              <User className="h-5 w-5" />
              Personal Trainer (PT) Assignment
            </h2>
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Select Personal Trainer</label>
              <select
                value={selectedTrainerId}
                onChange={(e) => setSelectedTrainerId(e.target.value)}
                className="gym-input"
              >
                <option value="">No Personal Trainer (General Plan)</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName} ({t.specialty})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Branch Assignment (Only visible/editable by Admin) */}
        {user?.role === 'ADMIN' && (
          <div className="glass-card p-6 rounded-2xl border border-slate-100 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gym-primary">
              <Sparkles className="h-5 w-5" />
              Branch Assignment
            </h2>
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Select Branch</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="gym-input"
              >
                <option value="">No Specific Branch (Global)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loadingSubmit}
          className="w-full py-4 bg-gradient-premium hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 transform active:scale-[0.98]"
        >
          {loadingSubmit ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
              Registering Account...
            </span>
          ) : (
            'Complete Registration'
          )}
        </button>
      </form>
    </div>
  );
};
