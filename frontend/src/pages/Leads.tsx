import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  UserPlus, 
  Phone, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Plus, 
  Search, 
  TrendingUp,
  UserCheck
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  interestedPlanId: string | null;
  status: 'NEW' | 'FOLLOWED_UP' | 'CONVERTED' | 'LOST';
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  branch?: { id: string; name: string };
}

export const Leads: React.FC = () => {
  const { activeBranchId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState<Lead['status']>('NEW');

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      const query = statusFilter !== 'ALL' ? `?status=${statusFilter}` : '';
      const data = await apiFetch<any>(`/leads${query}`, { headers });
      setLeads(data.leads || []);
    } catch (err: any) {
      console.error('Fetch leads error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [activeBranchId, statusFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      setError('Name and Phone number are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      await apiFetch<any>('/leads', {
        method: 'POST',
        headers,
        body: {
          name,
          email,
          phone,
          notes,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
          status,
        },
      });

      setIsModalOpen(false);
      resetForm();
      fetchLeads();
    } catch (err: any) {
      setError(err.message || 'Failed to create lead.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Lead['status']) => {
    try {
      await apiFetch<any>(`/leads/${id}`, {
        method: 'PUT',
        body: { status: newStatus },
      });
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleConvertToMember = async (lead: Lead) => {
    if (!window.confirm(`Convert ${lead.name} to an active member? This creates a member account.`)) return;

    try {
      await apiFetch<any>(`/leads/${lead.id}/convert`, {
        method: 'POST',
        body: {},
      });
      fetchLeads();
      alert(`Success! ${lead.name} has been converted into an active member.`);
    } catch (err: any) {
      alert(err.message || 'Failed to convert lead');
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setFollowUpDate('');
    setStatus('NEW');
    setError(null);
  };

  const filteredLeads = leads.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search) ||
    (l.email && l.email.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusBadge = (st: Lead['status']) => {
    switch (st) {
      case 'NEW':
        return <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold flex items-center gap-1"><Clock className="h-3 w-3" /> New Lead</span>;
      case 'FOLLOWED_UP':
        return <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Followed Up</span>;
      case 'CONVERTED':
        return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Converted</span>;
      case 'LOST':
        return <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold flex items-center gap-1"><XCircle className="h-3 w-3" /> Lost</span>;
    }
  };

  const newCount = leads.filter(l => l.status === 'NEW').length;
  const followUpCount = leads.filter(l => l.status === 'FOLLOWED_UP').length;
  const convertedCount = leads.filter(l => l.status === 'CONVERTED').length;
  const conversionRate = leads.length > 0 ? ((convertedCount / leads.length) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Pipeline Management</h1>
          <p className="text-gym-muted mt-1">Capture walk-ins, schedule follow-ups, and convert leads into active gym members.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-3 bg-gym-primary text-black font-bold rounded-2xl hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-gym-primary/20 cursor-pointer self-start"
        >
          <Plus className="h-5 w-5" /> Add New Lead
        </button>
      </div>

      {/* Analytics KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-gym-muted uppercase tracking-wider">Total Leads</span>
          <div className="text-3xl font-extrabold text-white">{leads.length}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">New Inquiries</span>
          <div className="text-3xl font-extrabold text-blue-400">{newCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Follow-Ups Active</span>
          <div className="text-3xl font-extrabold text-amber-400">{followUpCount}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100/10 space-y-2">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Conversion Rate</span>
          <div className="text-3xl font-extrabold text-emerald-400">{conversionRate}%</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-card p-4 rounded-2xl border border-slate-100/10 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-gym-muted" />
          <input
            type="text"
            placeholder="Search leads by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gym-input pl-10 text-xs"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          {['ALL', 'NEW', 'FOLLOWED_UP', 'CONVERTED', 'LOST'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-gym-primary text-black'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="text-center py-20 text-gym-muted">Loading leads pipeline...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass-card p-12 rounded-3xl border border-slate-100/10 text-center space-y-4">
          <UserPlus className="h-12 w-12 text-gym-muted mx-auto opacity-40" />
          <h3 className="text-lg font-bold">No leads found</h3>
          <p className="text-xs text-gym-muted max-w-sm mx-auto">
            No prospects match your query. Click "Add New Lead" or generate sample demo data from the dashboard!
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-100/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/40 text-xs font-bold text-gym-muted uppercase">
                  <th className="p-4">Lead Name</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Follow-Up Date</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-xs">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/30 transition-all">
                    <td className="p-4 font-bold text-white">
                      {lead.name}
                      {lead.branch && <span className="block text-[10px] text-gym-muted font-normal">{lead.branch.name}</span>}
                    </td>
                    <td className="p-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Phone className="h-3 w-3 text-gym-primary" /> {lead.phone}
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1.5 text-gym-muted text-[11px]">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{getStatusBadge(lead.status)}</td>
                    <td className="p-4 text-slate-300">
                      {lead.followUpDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-amber-400" />
                          {new Date(lead.followUpDate).toLocaleDateString()}
                        </div>
                      ) : (
                        <span className="text-gym-muted">Not Scheduled</span>
                      )}
                    </td>
                    <td className="p-4 max-w-xs truncate text-gym-muted">
                      {lead.notes || 'No notes added'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {lead.status !== 'CONVERTED' && (
                        <>
                          <select
                            value={lead.status}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-gym-primary"
                          >
                            <option value="NEW">NEW</option>
                            <option value="FOLLOWED_UP">FOLLOWED_UP</option>
                            <option value="LOST">LOST</option>
                          </select>
                          <button
                            onClick={() => handleConvertToMember(lead)}
                            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold rounded-lg transition-all text-xs border border-emerald-500/30 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Convert to Member
                          </button>
                        </>
                      )}
                      {lead.status === 'CONVERTED' && (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end text-xs">
                          <CheckCircle2 className="h-4 w-4" /> Active Member
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-slate-100/10 space-y-5 bg-slate-900 text-white shadow-2xl">
            <h3 className="text-xl font-bold">Add New Prospect Lead</h3>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{error}</div>}

            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              <div>
                <label className="block text-gym-muted font-bold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ankit Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="ankit@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="gym-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Pipeline Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Lead['status'])}
                    className="gym-input"
                  >
                    <option value="NEW">NEW</option>
                    <option value="FOLLOWED_UP">FOLLOWED_UP</option>
                    <option value="CONVERTED">CONVERTED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gym-muted font-bold mb-1">Follow-Up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="gym-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gym-muted font-bold mb-1">Notes / Preferences</label>
                <textarea
                  rows={3}
                  placeholder="Inquired about annual pass, prefers morning slot..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="gym-input"
                />
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
                  {submitting ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
