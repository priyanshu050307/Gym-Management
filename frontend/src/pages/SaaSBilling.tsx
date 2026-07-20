import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import {
  Check,
  MapPin,
  FileText,
  Zap
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
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string>('Primary Branch');
  const [now, setNow] = useState(new Date());
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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
      
      const activeBranchId = localStorage.getItem('activeBranchId') || '';
      const url = activeBranchId ? `/saas/status?branchId=${activeBranchId}` : '/saas/status';
      
      const data = await apiFetch<{ subscription: SaasSubscriptionData, allSubscriptions?: any[] }>(url);
      setSub(data.subscription);
      if (data.allSubscriptions) {
        setAllSubscriptions(data.allSubscriptions);
      }
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
    
    // Realtime countdown clock ticker
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeId = localStorage.getItem('activeBranchId');
    setSelectedBranchId(activeId);
    if (activeId && allSubscriptions.length > 0) {
      const match = allSubscriptions.find(s => s.branchId === activeId);
      if (match) {
        setSelectedBranchName(match.branch?.name || 'Primary Branch');
      }
    }
  }, [allSubscriptions]);

  const handleSubscribe = async (planName: string, cycle: 'MONTHLY' | 'HALF_YEARLY' | 'YEARLY') => {
    const loaded = await new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

    if (!loaded) {
      alert('Razorpay SDK failed to load. Are you offline?');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      // 1. Create Order targeting the selected branch
      const orderData = await apiFetch<any>('/saas/create-order', {
        method: 'POST',
        body: { planName, billingCycle: cycle, branchId: selectedBranchId },
      });

      // 2. Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Gymflow SaaS Platform',
        description: `Upgrade ${selectedBranchName} - ${cycle}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setActionLoading(true);
            // 3. Verify Payment on Backend
            const res = await apiFetch<any>('/saas/verify-payment', {
              method: 'POST',
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planName,
                billingCycle: cycle,
                cardBrand: 'Visa',
                cardLast4: '4242',
                gstin,
                billingAddress,
                branchId: selectedBranchId,
              },
            });

            setSub(res.subscription);
            setSuccess(`Successfully subscribed ${selectedBranchName} to GymOS Premium (${cycle})!`);
            // Reload page to reflect SaaS state changes in context
            setTimeout(() => window.location.reload(), 1500);
          } catch (err: any) {
            setError(err.message || 'SaaS payment verification failed.');
          } finally {
            setActionLoading(false);
          }
        },
        prefill: {
          name: orderData.user.name,
          email: orderData.user.email,
        },
        theme: {
          color: '#8b5cf6',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate SaaS payment.');
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



  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gym-darker">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
      </div>
    );
  }



  const planOptions = [
    {
      name: 'Monthly Plan',
      cycle: 'MONTHLY' as const,
      price: '₹500',
      periodText: 'mo',
      features: ['1 Branch Location', 'Up to 200 Gym Members', 'Check-In Kiosk Scanner', 'Basic Revenue Reports', 'SMS Alerts & Notifications'],
      badge: 'Starter Plan'
    },
    {
      name: '6-Month Plan',
      cycle: 'HALF_YEARLY' as const,
      price: '₹2,800',
      periodText: '6 mos',
      features: ['3 Branch Locations', 'Unlimited Members', 'QR Kiosk + Self-Service Portal', 'Class Schedules & Booking', 'Supplement Inventory POS', 'Multi-staff Access Control'],
      badge: 'Best Value',
      popular: true
    },
    {
      name: 'Yearly Plan',
      cycle: 'YEARLY' as const,
      price: '₹5,500',
      periodText: 'yr',
      features: ['Unlimited Locations', 'Unlimited Members', 'Dedicated Account Manager', 'Custom API access', 'White-labeled Gym Portal', 'All Platform Features Unlocked'],
      badge: 'Enterprise Level'
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

      {/* Real-time Expiration Alerts */}
      {(() => {
        const criticalSubs = allSubscriptions.filter(s => {
          const expiry = s.status === 'TRIAL_ACTIVE' ? s.trialEndDate : s.subscriptionEnd;
          if (!expiry) return false;
          const diffMs = new Date(expiry).getTime() - now.getTime();
          const days = Math.ceil(diffMs / (1000 * 3600 * 24));
          return s.status.includes('ACTIVE') && days <= 5 && days >= 0;
        });

        const getTimeRemainingStr = (targetDateStr: string) => {
          const diffMs = new Date(targetDateStr).getTime() - now.getTime();
          if (diffMs <= 0) return "Expired";
          const days = Math.floor(diffMs / (1000 * 3600 * 24));
          const hours = Math.floor((diffMs % (1000 * 3600 * 24)) / (1000 * 3600));
          const mins = Math.floor((diffMs % (1000 * 3600)) / (1000 * 60));
          const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
          return `${days}d ${hours}h ${mins}m ${secs}s`;
        };

        if (criticalSubs.length === 0) return null;

        return (
          <div className="space-y-3">
            {criticalSubs.map(s => {
              const expiry = s.status === 'TRIAL_ACTIVE' ? s.trialEndDate : s.subscriptionEnd;
              const daysLeft = Math.ceil((new Date(expiry).getTime() - now.getTime()) / (1000 * 3600 * 24));
              
              return (
                <div 
                  key={s.id} 
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-pulse ${
                    daysLeft <= 1 
                      ? 'bg-red-600/10 border-red-500/30 text-red-400' 
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-extrabold text-sm flex items-center gap-1.5">
                      ⚠️ {s.branch?.name || 'Primary Branch'} Subscription Expiry Warning
                    </div>
                    <p className="text-xs opacity-90">
                      Your plan for {s.branch?.name || 'Primary Branch'} is expiring soon. Renew now to prevent operations lockouts!
                    </p>
                  </div>
                  <div className="flex items-center gap-4 self-start sm:self-auto">
                    <div className="font-mono text-sm font-bold bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                      Time Left: {getTimeRemainingStr(expiry)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedBranchId(s.branchId);
                        setSelectedBranchName(s.branch?.name || 'Primary Branch');
                        document.getElementById('plans-selector')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-4 py-2 bg-gym-primary hover:bg-gym-primary-hover text-black text-xs font-bold rounded-lg shadow transition-all whitespace-nowrap cursor-pointer hover:scale-102"
                    >
                      Renew Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Branch Subscriptions List */}
      {allSubscriptions.length > 0 && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100/10 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gym-text">Active Branch Subscriptions</h3>
            <p className="text-xs text-gym-muted">Select a branch row to target it for upgrade or renewal below.</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100/10 text-gym-muted font-semibold uppercase tracking-wider pb-2">
                  <th className="py-2.5 pl-2">Branch Name</th>
                  <th>SaaS Plan</th>
                  <th>Billing Cycle</th>
                  <th>Status</th>
                  <th>Expiration / Trial Expiry</th>
                  <th className="text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSubscriptions.map((s) => {
                  const expiryDate = s.status === 'TRIAL_ACTIVE' ? s.trialEndDate : s.subscriptionEnd;
                  const isSelected = selectedBranchId === s.branchId;
                  const daysRemaining = expiryDate
                    ? Math.max(0, Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24)))
                    : 0;
                  
                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => {
                        setSelectedBranchId(s.branchId);
                        setSelectedBranchName(s.branch?.name || 'Primary Branch');
                      }}
                      className={`border-b border-slate-100/5 hover:bg-white/5 transition-all cursor-pointer ${
                        isSelected ? 'bg-gym-primary/5 border-l-2 border-l-gym-primary' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-2 font-bold text-gym-text">
                        {s.branch?.name || 'Primary Branch (Unlinked)'}
                        {isSelected && <span className="ml-2 px-1.5 py-0.5 bg-gym-primary text-black rounded text-[9px] font-bold">Selected</span>}
                      </td>
                      <td className="font-medium text-gym-primary">{s.planName}</td>
                      <td className="text-gym-muted uppercase font-bold">{s.billingCycle}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] border ${
                          s.status.includes('ACTIVE')
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}>
                          {s.status.replace('_', ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="font-mono text-gym-text">
                        {expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A'}
                        <span className="ml-2 text-gym-muted text-[10px]">
                          ({daysRemaining} days left)
                        </span>
                      </td>
                      <td className="text-right pr-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBranchId(s.branchId);
                            setSelectedBranchName(s.branch?.name || 'Primary Branch');
                            document.getElementById('plans-selector')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-gym-primary text-black' 
                              : 'bg-slate-800 text-gym-text border border-slate-700 hover:border-gym-primary'
                          }`}
                        >
                          Select to Upgrade
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plan selector toggles */}
      <div id="plans-selector" className="space-y-6 scroll-mt-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100/10 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gym-text">Upgrade Plan for: <span className="text-gym-primary font-black">{selectedBranchName}</span></h3>
            <p className="text-xs text-gym-muted">Select the duration plan that matches your gym operations budget.</p>
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
                  <span className="text-xs text-gym-muted">/{opt.periodText}</span>
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
                  onClick={() => handleSubscribe('Premium', opt.cycle)}
                  disabled={actionLoading}
                  className={`w-full py-3.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                    opt.popular
                      ? 'bg-gym-primary hover:bg-gym-primary-hover text-black shadow-gym-primary/10'
                      : 'bg-slate-900 hover:bg-slate-800 text-gym-text border border-slate-800'
                  }`}
                >
                  {sub?.billingCycle === opt.cycle && sub?.status.includes('ACTIVE') 
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

    </div>
  );
};
