import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Wrench,
  Dumbbell,
  Plus,
  Search,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle,
  Calendar,
  X,
  ShieldAlert
} from 'lucide-react';

interface EquipmentData {
  id: string;
  name: string;
  quantity: number;
  status: string;
  lastServiced: string | null;
  notes: string | null;
  branchId: string;
  branch: {
    id: string;
    name: string;
  };
}

export const Equipment: React.FC = () => {
  const { user, branches, activeBranchId } = useAuth();
  const [equipments, setEquipments] = useState<EquipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeEquipment, setActiveEquipment] = useState<EquipmentData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('WORKING');
  const [notes, setNotes] = useState('');
  const [lastServiced, setLastServiced] = useState('');
  const [branchId, setBranchId] = useState('');

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const fetchEquipments = async () => {
    try {
      setLoading(true);
      setError(null);
      // We pass the branchId if we want to explicitly filter, but apiFetch automatically appends header
      const data = await apiFetch<{ equipments: EquipmentData[] }>('/equipments');
      setEquipments(data.equipments);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch equipment list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipments();
  }, [activeBranchId]); // Refetch when active branch header changes

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setStatus('WORKING');
    setNotes('');
    setLastServiced('');
    setBranchId(branches[0]?.id || '');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (equip: EquipmentData) => {
    setActiveEquipment(equip);
    setName(equip.name);
    setQuantity(equip.quantity);
    setStatus(equip.status);
    setNotes(equip.notes || '');
    setLastServiced(equip.lastServiced ? new Date(equip.lastServiced).toISOString().split('T')[0] : '');
    setBranchId(equip.branchId);
    setShowEditModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setActionLoading(true);
      await apiFetch('/equipments', {
        method: 'POST',
        body: {
          name,
          quantity,
          status,
          notes: notes.trim() || null,
          lastServiced: lastServiced || null,
          branchId: user?.role === 'ADMIN' ? branchId : undefined,
        },
      });
      alert('Equipment added successfully!');
      setShowAddModal(false);
      fetchEquipments();
    } catch (err: any) {
      alert(err.message || 'Failed to add equipment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEquipment || !name.trim()) return;

    try {
      setActionLoading(true);
      await apiFetch(`/equipments/${activeEquipment.id}`, {
        method: 'PUT',
        body: {
          name,
          quantity,
          status,
          notes: notes.trim() || null,
          lastServiced: lastServiced || null,
          branchId: user?.role === 'ADMIN' ? branchId : undefined,
        },
      });
      alert('Equipment updated successfully!');
      setShowEditModal(false);
      fetchEquipments();
    } catch (err: any) {
      alert(err.message || 'Failed to update equipment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this equipment/machine?')) return;

    try {
      setActionLoading(true);
      await apiFetch(`/equipments/${id}`, { method: 'DELETE' });
      alert('Equipment deleted successfully!');
      fetchEquipments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete equipment.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter local state
  const filteredEquipments = equipments.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter ? item.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'WORKING':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          text: 'Working',
          icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
        };
      case 'MAINTENANCE':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          text: 'Maintenance',
          icon: <Wrench className="h-3.5 w-3.5 text-amber-600" />
        };
      case 'BROKEN':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          text: 'Broken',
          icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          text: status,
          icon: null
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gym-text tracking-tight flex items-center gap-2.5">
            <Dumbbell className="h-7 w-7 text-gym-primary" />
            Equipment & Machines
          </h1>
          <p className="text-sm text-gym-muted font-medium mt-1">
            Track machinery, barbell racks, cardio benches, and equipment servicing schedules.
          </p>
        </div>

        {isAuthorized && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-gym-primary text-black font-bold text-xs rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-gym-primary/20"
          >
            <Plus className="h-4 w-4" /> Add Equipment
          </button>
        )}
      </div>

      {/* Stats counter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Total Units</p>
            <h3 className="text-2xl font-black text-gym-text mt-1">
              {equipments.reduce((acc, curr) => acc + curr.quantity, 0)}
            </h3>
          </div>
          <div className="p-3 bg-gym-primary/10 text-gym-primary rounded-xl">
            <Dumbbell className="h-5 w-5" />
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Under Maintenance</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              {equipments.filter(e => e.status === 'MAINTENANCE').reduce((acc, curr) => acc + curr.quantity, 0)}
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Wrench className="h-5 w-5" />
          </div>
        </div>
        <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Broken Machines</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">
              {equipments.filter(e => e.status === 'BROKEN').reduce((acc, curr) => acc + curr.quantity, 0)}
            </h3>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gym-muted" />
          <input
            type="text"
            placeholder="Search equipment by name or comments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-gym-text text-sm focus:outline-none focus:border-gym-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-gym-text text-sm focus:outline-none focus:border-gym-primary cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="WORKING">Working</option>
          <option value="MAINTENANCE">Maintenance Required</option>
          <option value="BROKEN">Broken / Out of order</option>
        </select>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl p-4 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredEquipments.length === 0 ? (
        <div className="glass-card text-center py-16 rounded-3xl border border-slate-100">
          <Dumbbell className="h-12 w-12 mx-auto text-gym-muted/60" />
          <h3 className="text-lg font-bold text-gym-text mt-4">No equipment items found</h3>
          <p className="text-xs text-gym-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search queries or adding new fitness machines to the list.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipments.map((equip) => {
            const statusConfig = getStatusStyle(equip.status);
            return (
              <div
                key={equip.id}
                className="glass-card rounded-2xl border border-slate-100 p-5 space-y-4 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-extrabold text-gym-text text-base leading-snug">{equip.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase ${statusConfig.bg}`}>
                      {statusConfig.icon}
                      {statusConfig.text}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gym-muted font-bold block uppercase tracking-wide text-[9px]">Quantity</span>
                      <span className="font-extrabold text-gym-text text-sm">{equip.quantity} Unit{equip.quantity > 1 ? 's' : ''}</span>
                    </div>
                    <div>
                      <span className="text-gym-muted font-bold block uppercase tracking-wide text-[9px]">Branch Location</span>
                      <span className="font-semibold text-gym-text truncate block">{equip.branch.name}</span>
                    </div>
                  </div>

                  {equip.lastServiced && (
                    <div className="flex items-center gap-1.5 text-xs text-gym-muted font-medium bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                      <Calendar className="h-3.5 w-3.5 text-gym-primary shrink-0" />
                      <span>Last Serviced: {new Date(equip.lastServiced).toLocaleDateString()}</span>
                    </div>
                  )}

                  {equip.notes && (
                    <div className="text-xs text-gym-muted bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 italic">
                      "{equip.notes}"
                    </div>
                  )}
                </div>

                {isAuthorized && (
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(equip)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-slate-200 hover:border-gym-primary text-gym-text hover:text-gym-primary text-xs font-bold rounded-xl transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Details
                    </button>
                    <button
                      onClick={() => handleDelete(equip.id)}
                      className="px-3 py-2 border border-rose-200 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 2. ADD EQUIPMENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-200 space-y-5 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 p-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-gym-muted hover:text-gym-text"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gym-primary/20 text-gym-primary rounded-xl">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gym-text">Add New Equipment</h3>
                <p className="text-xs text-gym-muted">Add weights, benches, cardio units, or lifting machines.</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Machine / Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LifeFitness Treadmill T5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    <option value="WORKING">Working</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="BROKEN">Broken</option>
                  </select>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Branch Location</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Last Service Date</label>
                <input
                  type="date"
                  value={lastServiced}
                  onChange={(e) => setLastServiced(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Notes / Repair logs</label>
                <textarea
                  placeholder="Describe machine details, serial keys, issues..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="gym-input"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 bg-gym-primary hover:opacity-90 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {actionLoading ? 'Saving...' : 'Add Equipment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. EDIT EQUIPMENT MODAL */}
      {showEditModal && activeEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-200 space-y-5 relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 p-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-gym-muted hover:text-gym-text"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gym-primary/20 text-gym-primary rounded-xl">
                <Edit3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gym-text">Edit Equipment Details</h3>
                <p className="text-xs text-gym-muted">Modify status, logs, quantities, or details.</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Machine / Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. LifeFitness Treadmill T5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    <option value="WORKING">Working</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="BROKEN">Broken</option>
                  </select>
                </div>
              </div>

              {user?.role === 'ADMIN' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Branch Location</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Last Service Date</label>
                <input
                  type="date"
                  value={lastServiced}
                  onChange={(e) => setLastServiced(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Notes / Repair logs</label>
                <textarea
                  placeholder="Describe machine details, serial keys, issues..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="gym-input"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 bg-gym-primary hover:opacity-90 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
