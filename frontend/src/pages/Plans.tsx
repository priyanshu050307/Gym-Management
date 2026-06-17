import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { Sparkles, Trash2, Edit3, Plus } from 'lucide-react';

interface PlanData {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  description: string | null;
  isActive: boolean;
}

export const Plans: React.FC = () => {
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<{ plans: PlanData[] }>('/plans');
      setPlans(data.plans);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitLoading(true);

    try {
      if (editingId) {
        // Edit existing plan
        await apiFetch(`/plans/${editingId}`, {
          method: 'PUT',
          body: {
            name,
            price: parseFloat(price),
            durationMonths: parseInt(durationMonths),
            description,
          },
        });
      } else {
        // Create new plan
        await apiFetch('/plans', {
          method: 'POST',
          body: {
            name,
            price: parseFloat(price),
            durationMonths: parseInt(durationMonths),
            description,
          },
        });
      }

      // Reset form & reload
      setName('');
      setPrice('');
      setDurationMonths('1');
      setDescription('');
      setEditingId(null);
      setShowForm(false);
      await fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (plan: PlanData) => {
    setName(plan.name);
    setPrice(plan.price.toString());
    setDurationMonths(plan.durationMonths.toString());
    setDescription(plan.description || '');
    setEditingId(plan.id);
    setShowForm(true);
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to deactivate this membership plan? It will no longer be available for new subscriptions.')) {
      return;
    }

    try {
      await apiFetch(`/plans/${id}`, {
        method: 'DELETE',
      });
      await fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate plan.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Membership Packages</h1>
          <p className="text-gym-muted mt-1">Configure and manage membership subscriptions.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setName('');
            setPrice('');
            setDurationMonths('1');
            setDescription('');
            setShowForm(!showForm);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-premium hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all"
        >
          <Plus className="h-5 w-5" />
          {showForm && !editingId ? 'Hide Form' : 'Create Package'}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Plan Form Modal/Card */}
      {showForm && (
        <div className="glass-card p-6 rounded-2xl border border-slate-100 max-w-xl mx-auto space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gym-primary">
            <Sparkles className="h-5 w-5" />
            {editingId ? 'Edit Package Details' : 'Create New Package'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Package Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gold Monthly Membership"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:border-gym-primary focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gym-text/80 mb-2">Price (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="49.99"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:border-gym-primary focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gym-text/80 mb-2">Duration (Months)</label>
                <select
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:border-gym-primary focus:outline-none transition-all"
                >
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months (Annual)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gym-text/80 mb-2">Description / Inclusions</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Access to cardio room, steam sauna, and free weights..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-gym-text focus:border-gym-primary focus:outline-none transition-all"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-gym-text font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitLoading}
                className="flex-1 py-3 bg-gradient-premium hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all transform active:scale-95"
              >
                {submitLoading ? 'Saving...' : editingId ? 'Save Changes' : 'Create Package'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Plans */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-8 text-center text-gym-muted glass-card rounded-2xl border border-slate-100">
          No membership plans exist yet. Click "Create Package" to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`glass-card rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 relative group overflow-hidden ${
                plan.isActive ? 'border-slate-100 hover:border-gym-primary/20' : 'border-red-500/10 opacity-60'
              }`}
            >
              {/* Card visual highlight */}
              {plan.isActive && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gym-primary/5 rounded-bl-full group-hover:bg-gym-primary/10 transition-colors" />
              )}

              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-gym-primary transition-colors">
                      {plan.name}
                    </h3>
                    <span className="inline-block text-xs font-semibold text-gym-muted uppercase mt-1">
                      {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'} Validity
                    </span>
                  </div>
                  {!plan.isActive && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-3xl font-extrabold text-gym-primary">${plan.price.toFixed(2)}</span>
                  <span className="text-xs text-gym-muted">/pkg</span>
                </div>

                <p className="text-sm text-gym-muted line-clamp-3">
                  {plan.description || 'Full facilities access with premium trainers.'}
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2 relative z-10">
                <button
                  onClick={() => handleEdit(plan)}
                  className="flex-1 py-2 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-xl hover:bg-gym-primary hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="h-4 w-4" />
                  Modify
                </button>
                {plan.isActive && (
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="py-2 px-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all text-xs font-semibold"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
