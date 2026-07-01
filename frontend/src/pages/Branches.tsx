import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { MapPin, Phone, FileText, Plus, Edit2, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  gstNo?: string;
}

export const Branches: React.FC = () => {
  const { refreshProfile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNo, setGstNo] = useState('');

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ branches: Branch[] }>('/branches');
      setBranches(data.branches);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch branches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setAddress('');
    setPhone('');
    setGstNo('');
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (branch: Branch) => {
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address || '');
    setPhone(branch.phone || '');
    setGstNo(branch.gstNo || '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Branch name is required');
      return;
    }

    try {
      if (editingBranch) {
        // Update Branch
        await apiFetch(`/branches/${editingBranch.id}`, {
          method: 'PUT',
          body: { name, address, phone, gstNo },
        });
      } else {
        // Create Branch
        await apiFetch('/branches', {
          method: 'POST',
          body: { name, address, phone, gstNo },
        });
      }
      
      setModalOpen(false);
      fetchBranches();
      refreshProfile(); // Refresh branches in context
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;

    try {
      await apiFetch(`/branches/${id}`, {
        method: 'DELETE',
      });
      fetchBranches();
      refreshProfile(); // Refresh branches in context
    } catch (err: any) {
      alert(err.message || 'Failed to delete branch');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gym-text">Gym Branches</h1>
          <p className="text-sm text-gym-muted mt-1">
            Manage your physical gym branches and locations.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gym-primary hover:bg-gym-primary-hover text-black font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-gym-primary/25 self-start sm:self-auto"
        >
          <Plus className="h-5 w-5" />
          Add Branch
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
        </div>
      ) : branches.length === 0 ? (
        <div className="glass-card p-12 text-center border border-slate-100 rounded-2xl">
          <MapPin className="h-12 w-12 text-gym-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gym-text">No Branches Yet</h3>
          <p className="text-gym-muted text-sm mt-1 max-w-sm mx-auto">
            Get started by adding your first gym branch or facility location.
          </p>
          <button
            onClick={openCreateModal}
            className="mt-6 px-4 py-2 bg-gym-primary/10 text-gym-primary hover:bg-gym-primary/20 font-medium rounded-xl transition-all"
          >
            Create Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className="glass-card border border-slate-100/10 rounded-2xl p-6 flex flex-col justify-between hover:shadow-xl hover:border-gym-primary/30 transition-all duration-300 relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 h-24 w-24 bg-gym-primary/5 rounded-bl-full -z-10 group-hover:bg-gym-primary/10 transition-colors"></div>
              
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-gym-text group-hover:text-gym-primary transition-colors">
                      {branch.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(branch)}
                      className="p-2 hover:bg-slate-100 text-gym-muted hover:text-gym-text rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(branch.id)}
                      className="p-2 hover:bg-red-500/10 text-gym-muted hover:text-red-400 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm text-gym-muted">
                  {branch.address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4.5 w-4.5 text-gym-primary/70 shrink-0 mt-0.5" />
                      <span>{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4.5 w-4.5 text-gym-primary/70 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.gstNo && (
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-4.5 w-4.5 text-gym-primary/70 shrink-0" />
                      <span>GST: <span className="font-mono text-xs">{branch.gstNo}</span></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md border border-slate-100/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/10">
              <h2 className="text-xl font-bold text-gym-text">
                {editingBranch ? 'Edit Branch' : 'Add Gym Branch'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-gym-muted hover:text-gym-text transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">
                  Branch Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. Downtown Fitness Center"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">
                  Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="gym-input"
                  placeholder="Street name, City, State"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gym-muted mb-1.5">
                  GST Registration Number
                </label>
                <input
                  type="text"
                  value={gstNo}
                  onChange={(e) => setGstNo(e.target.value)}
                  className="gym-input"
                  placeholder="e.g. 07AAAAA1111A1Z1"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-xl transition-all shadow-md shadow-gym-primary/20"
                >
                  {editingBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
