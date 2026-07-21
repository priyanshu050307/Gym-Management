import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Briefcase
} from 'lucide-react';

interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email: string | null;
  phone: string | null;
}

interface PayrollRecord {
  id: string;
  trainerId: string;
  trainer: Trainer;
  month: number;
  year: number;
  baseSalary: number;
  sessionCount: number;
  sessionRate: number;
  bonus: number;
  deductions: number;
  totalAmount: number;
  status: 'PENDING' | 'PAID';
  paymentDate: string | null;
  notes: string | null;
  branch?: { id: string; name: string };
}

export const Payroll: React.FC = () => {
  const { activeBranchId } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [trainerId, setTrainerId] = useState('');
  const [baseSalary, setBaseSalary] = useState('20000');
  const [sessionCount, setSessionCount] = useState('10');
  const [sessionRate, setSessionRate] = useState('500');
  const [bonus, setBonus] = useState('0');
  const [deductions, setDeductions] = useState('0');
  const [status, setStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [notes, setNotes] = useState('');

  const fetchPayrolls = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      const data = await apiFetch<any>(`/payroll?month=${selectedMonth}&year=${selectedYear}`, { headers });
      setPayrolls(data.payrolls || []);
    } catch (err: any) {
      console.error('Fetch payrolls error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrainers = async () => {
    try {
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;
      const data = await apiFetch<any>('/trainers', { headers });
      setTrainers(data.trainers || []);
    } catch (err: any) {
      console.error('Fetch trainers error:', err);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, [activeBranchId]);

  useEffect(() => {
    fetchPayrolls();
  }, [activeBranchId, selectedMonth, selectedYear]);

  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerId) {
      setError('Please select a trainer.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      await apiFetch<any>('/payroll', {
        method: 'POST',
        headers,
        body: {
          trainerId,
          month: selectedMonth,
          year: selectedYear,
          baseSalary,
          sessionCount,
          sessionRate,
          bonus,
          deductions,
          status,
          notes,
        },
      });

      setIsModalOpen(false);
      resetForm();
      fetchPayrolls();
    } catch (err: any) {
      setError(err.message || 'Failed to save payroll record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (id: string, newStatus: 'PENDING' | 'PAID') => {
    try {
      await apiFetch<any>(`/payroll/${id}/status`, {
        method: 'PUT',
        body: { status: newStatus },
      });
      fetchPayrolls();
    } catch (err: any) {
      alert(err.message || 'Failed to update payout status');
    }
  };

  const resetForm = () => {
    setTrainerId('');
    setBaseSalary('20000');
    setSessionCount('10');
    setSessionRate('500');
    setBonus('0');
    setDeductions('0');
    setStatus('PENDING');
    setNotes('');
    setError(null);
  };

  const calculatedTotal = (
    (parseFloat(baseSalary || '0') + (parseInt(sessionCount || '0', 10) * parseFloat(sessionRate || '0')) + parseFloat(bonus || '0')) - parseFloat(deductions || '0')
  );

  const totalPayoutMonth = payrolls.reduce((acc, p) => acc + p.totalAmount, 0);
  const paidCount = payrolls.filter(p => p.status === 'PAID').length;
  const pendingCount = payrolls.filter(p => p.status === 'PENDING').length;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Payroll & Session Payouts</h1>
          <p className="text-gym-muted mt-1">Manage trainer base salaries, personal training session rates, bonuses, and monthly payouts.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 bg-gym-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-gym-primary/20 cursor-pointer self-start"
        >
          <Plus className="h-5 w-5" /> Process New Payout
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-gym-muted uppercase tracking-wider">Total Monthly Payout</span>
          <div className="text-3xl font-extrabold text-white">₹{totalPayoutMonth.toLocaleString()}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Disbursed (Paid)</span>
          <div className="text-3xl font-extrabold text-emerald-400">{paidCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Approval</span>
          <div className="text-3xl font-extrabold text-amber-400">{pendingCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-gym-primary uppercase tracking-wider">Active Staff Trainers</span>
          <div className="text-3xl font-extrabold text-gym-primary">{trainers.length}</div>
        </div>
      </div>

      {/* Month & Year Selectors */}
      <div className="glass-card p-4 rounded-2xl border border-slate-100/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gym-primary" />
          <span className="text-xs font-bold text-slate-300 uppercase">Payroll Period:</span>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="gym-input text-xs w-36"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="gym-input text-xs w-28"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payroll Table */}
      {loading ? (
        <div className="text-center py-20 text-gym-muted">Loading staff payroll records...</div>
      ) : payrolls.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-100/10 text-center space-y-4">
          <Briefcase className="h-12 w-12 text-gym-muted mx-auto opacity-40" />
          <h3 className="text-lg font-bold">No payroll records for {monthNames[selectedMonth - 1]} {selectedYear}</h3>
          <p className="text-xs text-gym-muted max-w-sm mx-auto">
            Click "Process New Payout" to calculate trainer base salary and session payouts for this month.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-100/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40 text-xs font-bold text-gym-muted uppercase">
                  <th className="p-4">Trainer Staff</th>
                  <th className="p-4">Base Salary</th>
                  <th className="p-4">PT Sessions</th>
                  <th className="p-4">Bonus / Deductions</th>
                  <th className="p-4">Net Payout</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {payrolls.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-800/30 transition-all">
                    <td className="p-4 font-bold text-white">
                      {record.trainer ? `${record.trainer.firstName} ${record.trainer.lastName}` : 'Trainer'}
                      {record.trainer?.specialty && (
                        <span className="block text-[10px] text-gym-muted font-normal">{record.trainer.specialty}</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300">₹{record.baseSalary.toLocaleString()}</td>
                    <td className="p-4 text-slate-300">
                      {record.sessionCount} sessions @ ₹{record.sessionRate}/ea
                      <span className="block font-bold text-gym-primary">₹{(record.sessionCount * record.sessionRate).toLocaleString()}</span>
                    </td>
                    <td className="p-4 space-y-0.5">
                      <div className="text-emerald-400 font-semibold">+₹{record.bonus.toLocaleString()} bonus</div>
                      <div className="text-red-400 font-semibold">-₹{record.deductions.toLocaleString()} ded.</div>
                    </td>
                    <td className="p-4 font-extrabold text-white text-sm">
                      ₹{record.totalAmount.toLocaleString()}
                    </td>
                    <td className="p-4">
                      {record.status === 'PAID' ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Paid ({record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : 'Disbursed'})
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-1 w-fit">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {record.status === 'PENDING' ? (
                        <button
                          onClick={() => handleStatusToggle(record.id, 'PAID')}
                          className="px-3 py-1 bg-gym-primary text-black font-bold rounded-lg text-xs hover:opacity-90 transition-all cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusToggle(record.id, 'PENDING')}
                          className="px-3 py-1 bg-slate-800 text-slate-300 font-bold rounded-lg text-xs hover:bg-slate-700 transition-all cursor-pointer"
                        >
                          Reset Status
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Payout Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-slate-100/10 space-y-5 bg-slate-900 text-white shadow-2xl">
            <h3 className="text-xl font-bold">Process Staff Payout</h3>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleSavePayroll} className="space-y-4 text-xs">
              <div>
                <label className="block text-gym-muted font-bold mb-1">Select Trainer Staff *</label>
                <select
                  required
                  value={trainerId}
                  onChange={(e) => setTrainerId(e.target.value)}
                  className="gym-input"
                >
                  <option value="">-- Choose Trainer --</option>
                  {trainers.map(t => (
                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.specialty})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Base Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-gym-muted font-bold mb-1">PT Sessions Conducted</label>
                  <input
                    type="number"
                    value={sessionCount}
                    onChange={(e) => setSessionCount(e.target.value)}
                    className="gym-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Rate Per Session (₹)</label>
                  <input
                    type="number"
                    value={sessionRate}
                    onChange={(e) => setSessionRate(e.target.value)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Incentive / Bonus (₹)</label>
                  <input
                    type="number"
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    className="gym-input text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Deductions (₹)</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    className="gym-input text-red-400"
                  />
                </div>
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Payment Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'PENDING' | 'PAID')}
                    className="gym-input"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>

              {/* Net Payout Preview */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="font-bold text-gym-muted">Calculated Net Payout:</span>
                <span className="text-lg font-extrabold text-gym-primary">₹{calculatedTotal.toLocaleString()}</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 bg-gym-primary text-black font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Calculating...' : 'Save Payout Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
