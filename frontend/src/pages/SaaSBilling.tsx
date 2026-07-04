import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import {
  Check,
  MapPin,
  FileText,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';

interface SaasSubscriptionData {
  id: string;
  status: string;
  planName: string;
  trialEndDate: string;
  subscriptionEnd: string | null;
  billingCycle: string;
  cardBrand: string | null;
  cardLast4: string | null;
  gstin: string | null;
  billingAddress: string | null;
}

export const SaaSBilling: React.FC = () => {
  const [sub, setSub] = useState<SaasSubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile Edit fields
  const [gstin, setGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);

  // Mock billing invoices
  const [invoices] = useState([
    { id: 'INV-SaaS-2026-001', date: '02-Jul-2026', amount: '₹0.00', plan: 'Starter Trial', status: 'Paid' }
  ]);

  const fetchSaaSStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ subscription: SaasSubscriptionData }>('/saas/status');
      setSub(data.subscription);
      setGstin(data.subscription.gstin || '');
      setBillingAddress(data.subscription.billingAddress || '');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch SaaS subscription details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaaSStatus();
  }, []);

  const handleSubscribe = async (planName: string) => {
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      let finalPrice = planName === 'Starter' ? 1499 : planName === 'Professional' ? 3499 : 7999;
      if (billingCycle === 'YEARLY') {
        finalPrice = finalPrice * 10; // 2 months discount
      }
      if (couponApplied) {
        finalPrice = Math.round(finalPrice * 0.7); // 30% FITJULY30 discount
      }

      const res = await apiFetch<any>('/saas/subscribe', {
        method: 'POST',
        body: {
          planName,
          billingCycle,
          cardBrand: 'Visa',
          cardLast4: '4242',
          gstin,
          billingAddress,
        },
      });

      setSub(res.subscription);
      setSuccess(`Successfully subscribed to GymOS ${planName} (${billingCycle})!`);
      // Reload page to reflect SaaS state changes in context
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to complete subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      const res = await apiFetch<any>('/saas/billing', {
        method: 'PUT',
        body: { gstin, billingAddress },
      });

      setSub(res.subscription);
      setSuccess('Billing address and details updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to update billing details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.toUpperCase() === 'FITJULY30') {
      setCouponApplied(true);
      setSuccess('Promo code FITJULY30 (30% Discount) applied successfully!');
    } else {
      setError('Invalid promo code.');
    }
  };

  // Helper function to simulate state triggers for verification
  const handleSimulateState = async (status: string, daysRemaining: number) => {
    try {
      setActionLoading(true);
      const res = await apiFetch<any>('/saas/reset', {
        method: 'POST',
        body: { status, daysRemaining },
      });
      setSub(res.subscription);
      setSuccess(`Simulator state set: ${status} with ${daysRemaining} days remaining.`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message || 'Simulator reset failed.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gym-darker">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
      </div>
    );
  }

  const daysRemaining = sub
    ? Math.max(0, Math.ceil((new Date(sub.trialEndDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))
    : 0;

  const planOptions = [
    {
      name: 'Starter',
      price: billingCycle === 'YEARLY' ? '₹14,990' : '₹1,499',
      features: ['1 Branch Location', 'Up to 200 Gym Members', 'Check-In Kiosk Scanner', 'Basic Revenue Reports', 'SMS Alerts & Notifications'],
      badge: 'Solopreneurs'
    },
    {
      name: 'Professional',
      price: billingCycle === 'YEARLY' ? '₹34,990' : '₹3,499',
      features: ['3 Branch Locations', 'Unlimited Members', 'QR Kiosk + Self-Service Portal', 'Class Schedules & Booking', 'Supplement Inventory POS', 'Multi-staff Access Control'],
      badge: 'Popular choice',
      popular: true
    },
    {
      name: 'Enterprise',
      price: billingCycle === 'YEARLY' ? '₹79,990' : '₹7,999',
      features: ['Unlimited Locations', 'Unlimited Members', 'Dedicated Account Manager', 'Custom API access', 'White-labeled Gym Portal', 'All Platform Features Unlocked'],
      badge: 'Large chains'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SaaS Subscription & Billing</h1>
        <p className="text-gym-muted mt-1">Manage GymOS cloud tenant plan, billing address, tax details, and payment histories.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      {/* Current Plan Card */}
      {sub && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gym-primary/5 rounded-bl-full -z-10" />
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
            <div>
              <span className="text-xs font-semibold text-gym-muted uppercase tracking-wider">Current SaaS Plan</span>
              <h2 className="text-2xl font-bold text-gym-primary mt-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {sub.planName} Plan
              </h2>
            </div>
            
            <div>
              <span className="text-xs font-semibold text-gym-muted uppercase tracking-wider">Status</span>
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${sub.status.includes('ACTIVE') ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="font-semibold capitalize text-sm">{sub.status.replace('_', ' ').toLowerCase()}</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-gym-muted uppercase tracking-wider">Billing Interval</span>
              <p className="font-medium text-sm mt-1">{sub.billingCycle}</p>
            </div>

            <div>
              <span className="text-xs font-semibold text-gym-muted uppercase tracking-wider">Trial Status</span>
              <p className="font-semibold text-sm mt-1 text-gym-primary">
                {sub.status === 'TRIAL_ACTIVE' ? `${daysRemaining} Days Remaining` : 'Trial Finished'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan selector toggles */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100/10 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gym-text">Upgrade or Change Subscription</h3>
            <p className="text-xs text-gym-muted">Select the plan that matches your business size. Save 20% with yearly payments.</p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                billingCycle === 'MONTHLY' ? 'bg-gym-primary text-black' : 'text-gym-muted hover:text-gym-text'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('YEARLY')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                billingCycle === 'YEARLY' ? 'bg-gym-primary text-black' : 'text-gym-muted hover:text-gym-text'
              }`}
            >
              Yearly (2 Months Free)
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planOptions.map((opt) => (
            <div
              key={opt.name}
              className={`glass-card rounded-3xl p-6 border relative flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 ${
                opt.popular 
                  ? 'border-gym-primary/40 shadow-lg shadow-gym-primary/5 bg-slate-900/30' 
                  : 'border-slate-100/10 hover:border-gym-primary/20'
              }`}
            >
              {opt.popular && (
                <span className="absolute -top-3 left-6 px-3 py-1 bg-gym-primary text-black text-[10px] font-extrabold uppercase rounded-full tracking-wider shadow">
                  Most Popular
                </span>
              )}

              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-bold text-gym-muted uppercase tracking-wider">{opt.badge}</span>
                  <h4 className="text-xl font-bold text-gym-text mt-1">{opt.name}</h4>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-gym-primary">{opt.price}</span>
                  <span className="text-xs text-gym-muted">/{billingCycle === 'YEARLY' ? 'yr' : 'mo'}</span>
                </div>

                <ul className="space-y-3 text-xs text-gym-muted border-t border-slate-100/10 pt-4">
                  {opt.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-gym-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <button
                  onClick={() => handleSubscribe(opt.name)}
                  disabled={actionLoading}
                  className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    opt.popular
                      ? 'bg-gym-primary hover:bg-gym-primary-hover text-black shadow-gym-primary/10'
                      : 'bg-slate-900 hover:bg-slate-800 text-gym-text border border-slate-800'
                  }`}
                >
                  {sub?.planName === opt.name && sub?.status.includes('ACTIVE') 
                    ? 'Current Plan' 
                    : `Subscribe ${opt.name}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coupon code */}
      {!couponApplied && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100/10 max-w-md">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-gym-primary" /> Apply Promo Code / Coupon
          </h4>
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. FITJULY30"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="gym-input text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl text-xs whitespace-nowrap"
            >
              Apply Code
            </button>
          </form>
          <span className="text-[10px] text-gym-muted mt-1.5 block">Use coupon code <strong className="text-gym-primary">FITJULY30</strong> for 30% discount.</span>
        </div>
      )}

      {/* Billing Profiles & Invoices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Address and GST */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100/10 space-y-4">
          <h4 className="font-bold text-base flex items-center gap-2 border-b border-slate-100/10 pb-3">
            <MapPin className="h-5 w-5 text-gym-primary" /> Billing Address & Tax Details
          </h4>
          <form onSubmit={handleUpdateBilling} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">GSTIN / Tax ID</label>
              <input
                type="text"
                placeholder="27AAAAA1111A1Z1"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="gym-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Billing Address</label>
              <textarea
                placeholder="123 Studio Street, Mumbai, MH"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                rows={3}
                className="gym-input text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-slate-900 border border-slate-800 text-gym-text hover:bg-slate-800 text-xs font-semibold rounded-xl"
            >
              Save Billing Profile
            </button>
          </form>
        </div>

        {/* Invoice List */}
        <div className="glass-card p-6 rounded-2xl border border-slate-100/10 space-y-4">
          <h4 className="font-bold text-base flex items-center gap-2 border-b border-slate-100/10 pb-3">
            <FileText className="h-5 w-5 text-gym-primary" /> Invoice History
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gym-muted uppercase border-b border-slate-100/10 pb-2">
                  <th className="py-2">Invoice ID</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100/5">
                    <td className="py-3 font-mono text-gym-primary">{inv.id}</td>
                    <td>{inv.date}</td>
                    <td>{inv.amount}</td>
                    <td>{inv.plan}</td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Simulator Section for Testing */}
      <div className="p-6 rounded-2xl border border-dashed border-gym-primary/30 bg-gym-primary/5 space-y-4">
        <h4 className="font-bold text-base text-gym-primary flex items-center gap-2">
          <Activity className="h-5 w-5" /> SaaS Billing Simulator (For System Testing)
        </h4>
        <p className="text-xs text-gym-muted">
          Use the actions below to trigger different SaaS subscription states. This allows you to verify how the rest of the application (members lists, schedules, bookings, equipment) locks write options once expired.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleSimulateState('TRIAL_ACTIVE', 29)}
            className="px-4.5 py-2.5 bg-slate-900 border border-slate-800 text-gym-text hover:bg-slate-800 rounded-xl text-xs font-medium"
          >
            Activate 30-Day Trial (Green Banner)
          </button>
          <button
            onClick={() => handleSimulateState('TRIAL_ACTIVE', 5)}
            className="px-4.5 py-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 rounded-xl text-xs font-medium"
          >
            Trial Impending Expiry (Orange Banner)
          </button>
          <button
            onClick={() => handleSimulateState('TRIAL_ACTIVE', 1)}
            className="px-4.5 py-2.5 bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 rounded-xl text-xs font-medium"
          >
            Trial Critical Expiring (Red Banner)
          </button>
          <button
            onClick={() => handleSimulateState('TRIAL_EXPIRED', 0)}
            className="px-4.5 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-xs font-bold shadow-md shadow-red-600/10"
          >
            Simulate Trial Expired (Lock Overlay)
          </button>
        </div>
      </div>
    </div>
  );
};
