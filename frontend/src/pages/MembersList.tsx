import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import { Search, UserPlus, FileText, CheckCircle2, AlertTriangle, AlertCircle, Eye, Trash2, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface MemberData {
  id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  joinDate: string;
  emergencyContact: string | null;
  profilePhoto?: string | null;
  trainerId?: string | null;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    branch?: {
      id: string;
      name: string;
    } | null;
  };
  subscriptions: Array<{
    id: string;
    endDate: string;
    plan: {
      name: string;
    };
  }>;
}

export const MembersList: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const handleDeleteMember = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this member? All subscriptions, payments, plans, check-ins, and logs will be deleted.')) {
      return;
    }

    try {
      await apiFetch(`/members/${id}`, {
        method: 'DELETE',
      });
      await fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to delete member.');
    }
  };

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let endpoint = '/members';
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }

      const data = await apiFetch<{ members: MemberData[] }>(endpoint);
      setMembers(data.members);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 300); // Debounce search input

    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3.5 w-3.5" />
            Paused
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="h-3.5 w-3.5" />
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members Directory</h1>
          <p className="text-gym-muted mt-1">View, search, and manage gym member accounts.</p>
        </div>
        <Link
          to="/members/register"
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-premium hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all"
        >
          <UserPlus className="h-5 w-5" />
          Add Member
        </Link>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gym-muted" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gym-input pl-12 pr-4"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {[
            { label: 'All Statuses', value: '' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Paused', value: 'PAUSED' },
            { label: 'Inactive', value: 'INACTIVE' },
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
        /* Members table */
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            {members.length === 0 ? (
              <div className="px-6 py-16 text-center text-gym-muted">
                No members found matching the current filters.
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-gym-muted text-sm font-semibold">
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4">Join Date</th>
                    <th className="px-6 py-4">Plan</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {members.map((member) => {
                    const activeSub = member.subscriptions[0];
                    const isMyPTClient = user?.role === 'TRAINER' && member.trainerId === user?.trainer?.id;
                    return (
                      <tr
                        key={member.id}
                        className={`transition-colors ${
                          isMyPTClient
                            ? 'bg-violet-600/10 hover:bg-violet-600/15 border-l-4 border-violet-500'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-gym-text flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full border border-slate-200 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                            {member.profilePhoto ? (
                              <img src={member.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="text-gym-primary font-bold text-xs uppercase">
                                {member.user.firstName[0]}{member.user.lastName[0]}
                              </div>
                            )}
                          </div>
                          <span className="flex items-center gap-2">
                            {member.user.firstName} {member.user.lastName}
                            {isMyPTClient && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-600 text-white shadow-sm border border-violet-500/30">
                                <Star className="h-2.5 w-2.5 fill-white" />
                                My PT Client
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gym-muted">{member.user.email}</td>
                        <td className="px-6 py-4 text-gym-muted">
                          {member.user.branch?.name || <span className="italic text-slate-400">Global</span>}
                        </td>
                        <td className="px-6 py-4 text-gym-muted">
                          {new Date(member.joinDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-gym-muted">
                          {activeSub ? (
                            <span className="flex items-center gap-1.5 text-gym-text">
                              <FileText className="h-4 w-4 text-gym-primary" />
                              {activeSub.plan.name}
                            </span>
                          ) : (
                            <span className="text-gym-muted italic">No active plan</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(member.status)}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <Link
                            to={`/members/${member.id}`}
                            className="inline-flex items-center gap-1 px-3 py-2 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-xl hover:bg-gym-primary hover:text-white transition-all text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Link>
                          {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                            <button
                              onClick={() => handleDeleteMember(member.id)}
                              className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 rounded-xl transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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
    </div>
  );
};
