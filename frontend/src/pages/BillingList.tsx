import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  CreditCard,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface PaymentData {
  id: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'FAILED';
  method: 'CASH' | 'CARD' | 'UPI' | 'STRIPE';
  paymentDate: string;
  isRefunded?: boolean;
  refundedAmount?: number;
  subscription: {
    plan: {
      name: string;
    };
    member: {
      user: {
        firstName: string;
        lastName: string;
        email: string;
        branch?: {
          id: string;
          name: string;
        } | null;
      };
    };
  };
}

export const BillingList: React.FC = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [activePayment, setActivePayment] = useState<PaymentData | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  // Manual payment state
  const [manualMethod, setManualMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH');
  const [actionLoading, setActionLoading] = useState(false);

  // Card Simulator state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardStep, setCardStep] = useState<'idle' | 'validating' | 'capturing' | 'success'>('idle');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = '/payments';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }

      const data = await apiFetch<{ payments: PaymentData[] }>(endpoint);
      setPayments(data.payments);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter]);

  // Handle manual recording
  const handleRecordManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayment) return;

    setActionLoading(true);
    try {
      await apiFetch(`/payments/${activePayment.id}/manual`, {
        method: 'POST',
        body: { method: manualMethod },
      });
      setShowManualModal(false);
      setActivePayment(null);
      fetchPayments();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle online card simulation
  const handleCardPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayment) return;

    // Client-side validations
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      setCardError('Card number must be 16 digits.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setCardError('Expiry date must be MM/YY.');
      return;
    }
    if (cardCVC.length !== 3) {
      setCardError('CVC must be 3 digits.');
      return;
    }

    setCardError(null);
    setCardStep('validating');

    // Simulate gateway delay 1
    setTimeout(() => {
      setCardStep('capturing');
      
      // Simulate gateway delay 2 & hit API
      setTimeout(async () => {
        try {
          await apiFetch(`/payments/${activePayment.id}/mock-pay`, {
            method: 'POST',
            body: {
              cardNumber,
              expiry: cardExpiry,
              cvc: cardCVC,
              cardholderName: cardName,
            },
          });
          setCardStep('success');
          setTimeout(() => {
            setShowCardModal(false);
            setCardStep('idle');
            setCardNumber('');
            setCardName('');
            setCardExpiry('');
            setCardCVC('');
            setActivePayment(null);
            fetchPayments();
          }, 2000);
        } catch (err: any) {
          setCardError(err.message || 'Mock authorization failed.');
          setCardStep('idle');
        }
      }, 1500);
    }, 1200);
  };

  // Card Number formatter helper
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, 16);
    const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  // Card Expiry formatter MM/YY helper
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (value.length > 2) {
      value = `${value.substring(0, 2)}/${value.substring(2)}`;
    }
    setCardExpiry(value);
  };

  // PDF invoice downloader helper
  const handleDownloadInvoice = (paymentId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const token = localStorage.getItem('token');
    
    // Trigger download by opening endpoint in new tab with auth token inside headers or query params
    // Since direct window.open can't send Auth headers, we can fetch the blob and download it in JS:
    fetch(`${API_URL}/payments/${paymentId}/invoice`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) throw new Error('Download failed');
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error(err);
      alert('Could not download invoice PDF. Please try again.');
    });
  };

  const handleRefund = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to refund this payment? This will process a full refund and notify the member.')) {
      return;
    }

    try {
      setActionLoading(true);
      await apiFetch(`/payments/${paymentId}/refund`, {
        method: 'POST',
      });
      alert('Refund processed successfully!');
      fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to process refund.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter payments locally by member search
  const filteredPayments = payments.filter((payment) => {
    const user = payment.subscription.member.user;
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const email = user.email.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || email.includes(query) || payment.id.includes(query);
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Paid
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            Failed
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Transactions</h1>
        <p className="text-gym-muted mt-1">Manage gym membership invoices, payments, and print copies.</p>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gym-muted" />
          <input
            type="text"
            placeholder="Search by name, email, or invoice ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gym-input pl-12 pr-4"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { label: 'All Receipts', value: '' },
            { label: 'Paid', value: 'PAID' },
            { label: 'Pending', value: 'PENDING' },
            { label: 'Failed', value: 'FAILED' },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-gym-primary text-white shadow-md'
                  : 'bg-gym-card/40 text-gym-muted border border-slate-100 hover:text-gym-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
        </div>
      ) : (
        /* Receipts Table */
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="px-6 py-16 text-center text-gym-muted">
                No billing records found matching the current criteria.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-gym-muted text-sm font-semibold">
                    <th className="px-6 py-4">Invoice ID</th>
                    <th className="px-6 py-4">Member</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Date / Method</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredPayments.map((payment) => {
                    const user = payment.subscription.member.user;
                    return (
                      <tr key={payment.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-gym-muted">
                          {payment.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gym-text">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-xs text-gym-muted">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 text-gym-muted">
                          {user.branch?.name || <span className="italic text-slate-400">Global</span>}
                        </td>
                        <td className="px-6 py-4 font-bold text-gym-text">
                          ₹{payment.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gym-muted">
                          {payment.subscription.plan.name}
                        </td>
                        <td className="px-6 py-4 text-gym-muted">
                          {payment.status === 'PAID' ? (
                            <div>
                              <div>{new Date(payment.paymentDate).toLocaleDateString()}</div>
                              <div className="text-[10px] text-gym-primary font-bold uppercase">
                                {payment.method}
                              </div>
                            </div>
                          ) : (
                            <span className="italic text-xs text-gym-muted">Awaiting checkout</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                        <td className="px-6 py-4 text-right space-y-1.5 sm:space-y-0 sm:space-x-1.5 whitespace-nowrap">
                          {payment.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setActivePayment(payment);
                                  setShowManualModal(true);
                                }}
                                className="inline-flex items-center px-2.5 py-1.5 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-xl hover:bg-gym-primary hover:text-white transition-all text-xs font-semibold"
                              >
                                Record Cash
                              </button>
                              <button
                                onClick={() => {
                                  setActivePayment(payment);
                                  setShowCardModal(true);
                                  setCardStep('idle');
                                }}
                                className="inline-flex items-center px-2.5 py-1.5 bg-gym-secondary/10 text-gym-secondary border border-gym-secondary/20 rounded-xl hover:bg-gym-secondary hover:text-white transition-all text-xs font-semibold"
                              >
                                Pay Online
                              </button>
                            </>
                          )}
                          {payment.status === 'PAID' && (
                            <div className="inline-flex items-center gap-2">
                              {payment.isRefunded ? (
                                <span className="inline-flex px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                  Refunded (₹{payment.refundedAmount})
                                </span>
                              ) : (
                                <>
                                  {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                                    <button
                                      onClick={() => handleRefund(payment.id)}
                                      disabled={actionLoading}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-xl transition-all text-xs font-semibold"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Refund
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => handleDownloadInvoice(payment.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 text-gym-text transition-all text-xs font-semibold"
                              >
                                <Download className="h-3.5 w-3.5" />
                                PDF
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 1. MANUAL RECORDING MODAL */}
      {showManualModal && activePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-200 space-y-5 relative">
            <button
              onClick={() => {
                setShowManualModal(false);
                setActivePayment(null);
              }}
              className="absolute right-4 top-4 text-gym-muted hover:text-gym-text"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-xl font-bold">Record Cashier Payment</h3>
              <p className="text-gym-muted text-sm mt-1">
                Log a payment received at the reception counter.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
              <div className="flex justify-between text-sm text-gym-muted">
                <span>Member Name</span>
                <span className="font-semibold text-gym-text">
                  {activePayment.subscription.member.user.firstName}{' '}
                  {activePayment.subscription.member.user.lastName}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gym-muted">
                <span>Plan Package</span>
                <span className="font-semibold text-gym-text">
                  {activePayment.subscription.plan.name}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gym-muted pt-2 border-t border-slate-100">
                <span>Amount Due</span>
                <span className="font-bold text-gym-primary text-base">
                  ₹{activePayment.amount.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordManual} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gym-muted mb-2">
                  Payment Method
                </label>
                <select
                  value={manualMethod}
                  onChange={(e) => setManualMethod(e.target.value as any)}
                  className="gym-input"
                >
                  <option value="CASH">Cash Payment</option>
                  <option value="CARD">Debit / Credit Card Swipe</option>
                  <option value="UPI">UPI Scanner (GPay / PhonePe)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3.5 bg-gym-primary text-white font-semibold rounded-xl transition-all hover:bg-gym-primary/80 disabled:opacity-50"
              >
                {actionLoading ? 'Recording Transaction...' : 'Confirm Cashier Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. MOCK ONLINE CARD GATEWAY MODAL */}
      {showCardModal && activePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card max-w-lg w-full p-8 rounded-3xl border border-white/15 space-y-6 relative overflow-hidden">
            {/* Visual background accents */}
            <div className="absolute top-[-50px] right-[-50px] w-64 h-64 rounded-full bg-gym-secondary/10 blur-[60px]" />
            <div className="absolute bottom-[-50px] left-[-50px] w-64 h-64 rounded-full bg-gym-primary/10 blur-[60px]" />

            <button
              onClick={() => {
                if (cardStep === 'idle' || cardStep === 'success') {
                  setShowCardModal(false);
                  setActivePayment(null);
                }
              }}
              disabled={cardStep === 'validating' || cardStep === 'capturing'}
              className="absolute right-4 top-4 text-gym-muted hover:text-gym-text z-10"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <div className="relative z-10">
              <h3 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                <CreditCard className="h-6 w-6 text-gym-secondary" />
                Mock Payment Gateway
              </h3>
              <p className="text-gym-muted text-xs mt-1">
                Enter simulated card details. Absolutely no real funds will be charged.
              </p>
            </div>

            {cardStep === 'idle' && (
              <form onSubmit={handleCardPaymentSubmit} className="space-y-6 relative z-10">
                {/* 3D Glassmorphism Card Display */}
                <div className="w-full h-44 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-700 to-gym-primary p-6 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden border border-slate-200">
                  <div className="flex justify-between items-start">
                    <span className="text-xs tracking-widest font-mono text-white/70">MOCK CARD</span>
                    <ShieldCheck className="h-6 w-6 text-white/50" />
                  </div>
                  <div>
                    <div className="text-lg font-mono tracking-widest text-center">
                      {cardNumber || '•••• •••• •••• ••••'}
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-[8px] text-white/50 uppercase">Cardholder</div>
                      <div className="text-xs font-mono truncate max-w-[150px] uppercase">
                        {cardName || 'YOUR FULL NAME'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] text-white/50 uppercase text-right">Expires</div>
                      <div className="text-xs font-mono text-right">{cardExpiry || 'MM/YY'}</div>
                    </div>
                  </div>
                </div>

                {cardError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{cardError}</span>
                  </div>
                )}

                {/* Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gym-text/80 mb-2">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="JOHN DOE"
                      className="gym-input uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-text/80 mb-2">Card Number</label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="4242 4242 4242 4242"
                      className="gym-input font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gym-text/80 mb-2">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="gym-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gym-text/80 mb-2">CVC Security Code</label>
                      <input
                        type="password"
                        required
                        maxLength={3}
                        value={cardCVC}
                        onChange={(e) => setCardCVC(e.target.value.replace(/\D/g, ''))}
                        placeholder="•••"
                        className="gym-input font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-premium text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-[0.98] hover:opacity-95 text-sm"
                >
                  Pay ₹{activePayment.amount.toFixed(2)} Online
                </button>
              </form>
            )}

            {/* PROCESSING LOADING SCREENS */}
            {(cardStep === 'validating' || cardStep === 'capturing' || cardStep === 'success') && (
              <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center relative z-10">
                {cardStep === 'validating' && (
                  <>
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
                    <div>
                      <h4 className="font-bold text-lg">Contacting Card Issuer...</h4>
                      <p className="text-xs text-gym-muted mt-1">Verifying card authenticity and sandbox credentials.</p>
                    </div>
                  </>
                )}

                {cardStep === 'capturing' && (
                  <>
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-gym-secondary border-t-transparent"></div>
                    <div>
                      <h4 className="font-bold text-lg text-gym-secondary">Capturing Funds...</h4>
                      <p className="text-xs text-gym-muted mt-1">Authorizing transaction item. Updating ledger entries.</p>
                    </div>
                  </>
                )}

                {cardStep === 'success' && (
                  <>
                    <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                      <CheckCircle2 className="h-10 w-10 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xl text-emerald-400">Mock Payment Authorized!</h4>
                      <p className="text-xs text-gym-muted mt-1">Transaction logged. Invoices generated successfully.</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
