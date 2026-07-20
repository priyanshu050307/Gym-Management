import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { MapPin, Phone, FileText, Plus, Edit2, Trash2, X, Users } from 'lucide-react';
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
  
  // SaaS billing states
  const [subCount, setSubCount] = useState(0);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [gstNo, setGstNo] = useState('');

  // Staff registration state (for new branch creation)
  const [createStaff, setCreateStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFirstName, setStaffFirstName] = useState('');
  const [staffLastName, setStaffLastName] = useState('');

  const fetchSaaSInfo = async () => {
    try {
      const data = await apiFetch<{ allSubscriptions?: any[], subscription?: any }>('/saas/status');
      if (data.allSubscriptions) {
        setSubCount(data.allSubscriptions.length);
      }
      if (data.subscription) {
        setActivePlan(data.subscription);
      }
    } catch (err) {
      console.error('Failed to load SaaS info:', err);
    }
  };

  // Staff Portal States
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedBranchForStaff, setSelectedBranchForStaff] = useState<Branch | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffFirstName, setNewStaffFirstName] = useState('');
  const [newStaffLastName, setNewStaffLastName] = useState('');

  const fetchBranchStaff = async (branchId: string) => {
    try {
      setStaffLoading(true);
      setStaffError('');
      const data = await apiFetch<{ staff: any[] }>(`/branches/${branchId}/staff`);
      setStaffList(data.staff);
    } catch (err: any) {
      setStaffError(err.message || 'Failed to fetch staff members');
    } finally {
      setStaffLoading(false);
    }
  };

  const openStaffModal = (branch: Branch) => {
    setSelectedBranchForStaff(branch);
    setStaffModalOpen(true);
    setStaffFormOpen(false);
    setEditingStaff(null);
    clearStaffForm();
    fetchBranchStaff(branch.id);
  };

  const clearStaffForm = () => {
    setNewStaffEmail('');
    setNewStaffPassword('');
    setNewStaffFirstName('');
    setNewStaffLastName('');
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchForStaff) return;
    if (!newStaffEmail || !newStaffFirstName || !newStaffLastName || (!editingStaff && !newStaffPassword)) {
      setStaffError('Please fill in all required fields.');
      return;
    }

    try {
      setStaffLoading(true);
      if (editingStaff) {
        await apiFetch(`/branches/${selectedBranchForStaff.id}/staff/${editingStaff.id}`, {
          method: 'PUT',
          body: {
            email: newStaffEmail,
            password: newStaffPassword || undefined,
            firstName: newStaffFirstName,
            lastName: newStaffLastName,
          },
        });
      } else {
        await apiFetch(`/branches/${selectedBranchForStaff.id}/staff`, {
          method: 'POST',
          body: {
            email: newStaffEmail,
            password: newStaffPassword,
            firstName: newStaffFirstName,
            lastName: newStaffLastName,
          },
        });
      }
      setStaffFormOpen(false);
      setEditingStaff(null);
      clearStaffForm();
      fetchBranchStaff(selectedBranchForStaff.id);
    } catch (err: any) {
      setStaffError(err.message || 'Staff operation failed');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleStaffDelete = async (staffId: string) => {
    if (!selectedBranchForStaff) return;
    if (!window.confirm('Are you sure you want to remove this staff member?')) return;

    try {
      setStaffLoading(true);
      await apiFetch(`/branches/${selectedBranchForStaff.id}/staff/${staffId}`, {
        method: 'DELETE',
      });
      fetchBranchStaff(selectedBranchForStaff.id);
    } catch (err: any) {
      setStaffError(err.message || 'Failed to delete staff member');
    } finally {
      setStaffLoading(false);
    }
  };

  const openEditStaffForm = (staff: any) => {
    setEditingStaff(staff);
    setNewStaffEmail(staff.email);
    setNewStaffFirstName(staff.firstName);
    setNewStaffLastName(staff.lastName);
    setNewStaffPassword('');
    setStaffFormOpen(true);
  };

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
    fetchSaaSInfo();
  }, []);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName('');
    setAddress('');
    setPhone('');
    setGstNo('');
    setCreateStaff(false);
    setStaffEmail('');
    setStaffPassword('');
    setStaffFirstName('');
    setStaffLastName('');
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

    if (phone && !/^\d{10}$/.test(phone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!editingBranch && createStaff) {
      if (!staffEmail || !staffPassword || !staffFirstName || !staffLastName) {
        setError('Please fill in all staff details.');
        return;
      }
      if (!staffEmail.includes('@')) {
        setError('Please enter a valid staff email address.');
        return;
      }
    }

    const limitExceeded = !editingBranch && branches.length >= subCount;

    if (limitExceeded) {
      try {
        setPaymentLoading(true);
        setError('');
        
        const loaded = await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        if (!loaded) {
          setError('Razorpay SDK failed to load. Are you offline?');
          setPaymentLoading(false);
          return;
        }

        const planName = activePlan?.planName || 'Premium';
        const cycle = activePlan?.billingCycle || 'MONTHLY';
        
        const orderData = await apiFetch<any>('/saas/create-order', {
          method: 'POST',
          body: { planName, billingCycle: cycle },
        });

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'GymOS Platform',
          description: `Add Gym Branch Slot - ${planName} (${cycle})`,
          order_id: orderData.orderId,
          handler: async function (response: any) {
            try {
              setPaymentLoading(true);
              await apiFetch<any>('/saas/verify-payment', {
                method: 'POST',
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planName,
                  billingCycle: cycle,
                },
              });

              // Create branch after verified payment
              await apiFetch('/branches', {
                method: 'POST',
                body: { 
                  name, 
                  address, 
                  phone, 
                  gstNo,
                  staffEmail: createStaff ? staffEmail : undefined,
                  staffPassword: createStaff ? staffPassword : undefined,
                  staffFirstName: createStaff ? staffFirstName : undefined,
                  staffLastName: createStaff ? staffLastName : undefined
                },
              });

              setModalOpen(false);
              fetchBranches();
              fetchSaaSInfo();
              refreshProfile();
            } catch (err: any) {
              setError(err.message || 'Payment verification or branch creation failed.');
            } finally {
              setPaymentLoading(false);
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
        setError(err.message || 'Payment initiation failed.');
        setPaymentLoading(false);
      }
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
          body: { 
            name, 
            address, 
            phone, 
            gstNo,
            staffEmail: createStaff ? staffEmail : undefined,
            staffPassword: createStaff ? staffPassword : undefined,
            staffFirstName: createStaff ? staffFirstName : undefined,
            staffLastName: createStaff ? staffLastName : undefined
          },
        });
      }
      
      setModalOpen(false);
      fetchBranches();
      fetchSaaSInfo();
      refreshProfile();
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
                      onClick={() => openStaffModal(branch)}
                      className="p-2 hover:bg-slate-100 text-gym-muted hover:text-gym-text rounded-lg transition-all"
                      title="Manage Staff"
                    >
                      <Users className="h-4 w-4 text-gym-primary" />
                    </button>
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
          <div className="glass-card w-full max-w-md border border-slate-100/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/10 shrink-0">
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

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[70vh]">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {!editingBranch && branches.length >= subCount && activePlan && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-amber-300 text-xs leading-relaxed space-y-1.5 animate-pulse">
                  <div className="font-bold flex items-center gap-1.5">
                    ⚠️ Branch License Capacity Reached
                  </div>
                  <p>
                    You have used all {subCount} active branch slots. Adding this new branch requires purchasing an additional slot under your current plan **({activePlan.planName} - {activePlan.billingCycle})** for **₹{activePlan.billingCycle === 'YEARLY' ? '5,500' : activePlan.billingCycle === 'HALF_YEARLY' ? '2,800' : '500'}**.
                  </p>
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

              {!editingBranch && (
                <div className="border-t border-slate-100/10 pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="createStaffCheckbox"
                      checked={createStaff}
                      onChange={(e) => setCreateStaff(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-gym-primary focus:ring-gym-primary cursor-pointer h-4 w-4"
                    />
                    <label htmlFor="createStaffCheckbox" className="text-sm font-semibold text-gym-primary cursor-pointer select-none">
                      Create an initial staff account for this branch
                    </label>
                  </div>
                  
                  {createStaff && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gym-muted mb-1">
                            First Name *
                          </label>
                          <input
                            type="text"
                            value={staffFirstName}
                            onChange={(e) => setStaffFirstName(e.target.value)}
                            className="gym-input text-sm"
                            placeholder="John"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gym-muted mb-1">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={staffLastName}
                            onChange={(e) => setStaffLastName(e.target.value)}
                            className="gym-input text-sm"
                            placeholder="Doe"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gym-muted mb-1">
                          Staff Email *
                        </label>
                        <input
                          type="email"
                          value={staffEmail}
                          onChange={(e) => setStaffEmail(e.target.value)}
                          className="gym-input text-sm"
                          placeholder="staff@gym.com"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gym-muted mb-1">
                          Staff Password *
                        </label>
                        <input
                          type="password"
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          className="gym-input text-sm"
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                 <button
                  type="submit"
                  disabled={paymentLoading}
                  className="px-5 py-2 text-sm font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-xl transition-all shadow-md shadow-gym-primary/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] flex items-center justify-center"
                >
                  {paymentLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                  ) : editingBranch ? (
                    'Save Changes'
                  ) : (!editingBranch && branches.length >= subCount) ? (
                    `Pay & Create Branch (₹${activePlan?.billingCycle === 'YEARLY' ? '5,500' : activePlan?.billingCycle === 'HALF_YEARLY' ? '2,800' : '500'})`
                  ) : (
                    'Create Branch'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Staff Management Modal */}
      {staffModalOpen && selectedBranchForStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-2xl border border-slate-100/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/10 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gym-text">
                  Manage Staff
                </h2>
                <p className="text-xs text-gym-muted mt-0.5">
                  Branch: <span className="text-gym-primary font-semibold">{selectedBranchForStaff.name}</span>
                </p>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-gym-muted hover:text-gym-text transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {staffError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {staffError}
                </div>
              )}

              {/* Add/Edit Staff Form Toggle Button */}
              {!staffFormOpen ? (
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    clearStaffForm();
                    setStaffFormOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gym-primary/10 text-gym-primary hover:bg-gym-primary/20 font-semibold rounded-xl text-sm transition-all"
                >
                  <Plus className="h-4 w-4" /> Add Staff Member
                </button>
              ) : (
                <form onSubmit={handleStaffSubmit} className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-xl space-y-4 animate-fade-in">
                  <h3 className="text-sm font-bold text-gym-text">
                    {editingStaff ? 'Edit Staff Details' : 'Add New Staff Member'}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gym-muted uppercase mb-1">First Name *</label>
                      <input
                        type="text"
                        value={newStaffFirstName}
                        onChange={(e) => setNewStaffFirstName(e.target.value)}
                        placeholder="John"
                        className="gym-input text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gym-muted uppercase mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={newStaffLastName}
                        onChange={(e) => setNewStaffLastName(e.target.value)}
                        placeholder="Doe"
                        className="gym-input text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-muted uppercase mb-1">Email Address *</label>
                    <input
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="staff@mygym.com"
                      className="gym-input text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gym-muted uppercase mb-1">
                      Password {editingStaff ? '(Leave blank to keep unchanged)' : '*'}
                    </label>
                    <input
                      type="password"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="gym-input text-xs"
                      required={!editingStaff}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setStaffFormOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-gym-muted hover:text-gym-text hover:bg-slate-100 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffLoading}
                      className="px-4 py-1.5 text-xs font-semibold bg-gym-primary hover:bg-gym-primary-hover text-black rounded-lg transition-all"
                    >
                      {editingStaff ? 'Save Changes' : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}

              {/* Staff List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gym-muted uppercase tracking-wider">
                  Active Branch Staff
                </h3>

                {staffLoading && staffList.length === 0 ? (
                  <div className="py-8 text-center text-gym-muted text-sm">
                    Loading staff records...
                  </div>
                ) : staffList.length === 0 ? (
                  <div className="py-8 text-center text-gym-muted text-xs border border-dashed border-slate-800 rounded-xl">
                    No staff accounts assigned to this branch yet.
                  </div>
                ) : (
                  <div className="border border-slate-800/80 rounded-xl divide-y divide-slate-800 overflow-hidden">
                    {staffList.map((staff) => (
                      <div key={staff.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-900/30 transition-colors">
                        <div>
                          <p className="font-semibold text-gym-text text-sm">
                            {staff.firstName} {staff.lastName}
                          </p>
                          <p className="text-xs text-gym-muted font-mono mt-0.5">
                            {staff.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditStaffForm(staff)}
                            className="p-1.5 hover:bg-slate-800 text-gym-muted hover:text-gym-text rounded-lg transition-all"
                            title="Edit Staff Info"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleStaffDelete(staff.id)}
                            className="p-1.5 hover:bg-red-500/10 text-gym-muted hover:text-red-400 rounded-lg transition-all"
                            title="Remove Staff"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-900/20 border-t border-slate-100/10 shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gym-text hover:bg-slate-100 rounded-xl transition-all"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
