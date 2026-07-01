import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  ShoppingBag,
  Plus,
  Search,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle,
  X,
  Package,
  TrendingDown,
  Tag,
  DollarSign,
  UserCheck,
  History,
  FileText
} from 'lucide-react';

interface SupplementData {
  id: string;
  name: string;
  price: number;
  stock: number;
  description: string | null;
  category: string | null;
  branchId: string;
  branch: {
    id: string;
    name: string;
  };
}

interface SaleData {
  id: string;
  supplementId: string;
  supplement: {
    name: string;
    category: string | null;
  };
  memberId: string;
  member: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  quantity: number;
  soldPrice: number;
  saleType: string;
  notes: string | null;
  branch: {
    name: string;
  };
  createdAt: string;
}

interface MemberListItem {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export const Supplements: React.FC = () => {
  const { user, branches, activeBranchId } = useAuth();
  const [supplements, setSupplements] = useState<SupplementData[]>([]);
  const [sales, setSales] = useState<SaleData[]>([]);
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [activeSupplement, setActiveSupplement] = useState<SupplementData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states (Add/Edit)
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('PROTEIN');
  const [branchId, setBranchId] = useState('');

  // Form states (Sell Checkout)
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [sellQuantity, setSellQuantity] = useState(1);
  const [sellPrice, setSellPrice] = useState(0);
  const [saleType, setSaleType] = useState('PAID');
  const [sellNotes, setSellNotes] = useState('');

  const isAuthorized = user?.role === 'ADMIN' || user?.role === 'STAFF';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const suppData = await apiFetch<{ supplements: SupplementData[] }>('/supplements');
      setSupplements(suppData.supplements);

      if (isAuthorized) {
        // Fetch sales logs
        const salesData = await apiFetch<{ sales: SaleData[] }>('/sales');
        setSales(salesData.sales);

        // Fetch gym members for selling
        const membersData = await apiFetch<{ members: MemberListItem[] }>('/members');
        setMembers(membersData.members);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  const resetForm = () => {
    setName('');
    setPrice(0);
    setStock(0);
    setDescription('');
    setCategory('PROTEIN');
    setBranchId(branches[0]?.id || '');
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleOpenEdit = (supp: SupplementData) => {
    setActiveSupplement(supp);
    setName(supp.name);
    setPrice(supp.price);
    setStock(supp.stock);
    setDescription(supp.description || '');
    setCategory(supp.category || 'PROTEIN');
    setBranchId(supp.branchId);
    setShowEditModal(true);
  };

  const handleOpenSell = (supp: SupplementData) => {
    setActiveSupplement(supp);
    setSelectedMemberId(members[0]?.id || '');
    setSellQuantity(1);
    setSellPrice(supp.price);
    setSaleType('PAID');
    setSellNotes('');
    setShowSellModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0) return;

    try {
      setActionLoading(true);
      await apiFetch('/supplements', {
        method: 'POST',
        body: {
          name,
          price,
          stock,
          description: description.trim() || null,
          category,
          branchId: user?.role === 'ADMIN' ? branchId : undefined,
        },
      });
      alert('Supplement added successfully!');
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to add supplement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplement || !name.trim() || price <= 0) return;

    try {
      setActionLoading(true);
      await apiFetch(`/supplements/${activeSupplement.id}`, {
        method: 'PUT',
        body: {
          name,
          price,
          stock,
          description: description.trim() || null,
          category,
          branchId: user?.role === 'ADMIN' ? branchId : undefined,
        },
      });
      alert('Supplement details updated successfully!');
      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update supplement.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplement || !selectedMemberId || sellQuantity <= 0) return;

    try {
      setActionLoading(true);
      await apiFetch('/sales', {
        method: 'POST',
        body: {
          supplementId: activeSupplement.id,
          memberId: selectedMemberId,
          quantity: sellQuantity,
          soldPrice: saleType === 'FREE_WITH_SUBSCRIPTION' ? 0 : sellPrice,
          saleType,
          notes: sellNotes.trim() || null,
        },
      });
      alert('Supplement sale registered successfully!');
      setShowSellModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record supplement sale.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this supplement item?')) return;

    try {
      setActionLoading(true);
      await apiFetch(`/supplements/${id}`, { method: 'DELETE' });
      alert('Supplement deleted successfully!');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplement.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter local state
  const filteredSupplements = supplements.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const filteredSales = sales.filter((sale) => {
    const memberName = `${sale.member.user.firstName} ${sale.member.user.lastName}`.toLowerCase();
    const matchesSearch = memberName.includes(salesSearchQuery.toLowerCase()) ||
                          sale.supplement.name.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
                          (sale.notes && sale.notes.toLowerCase().includes(salesSearchQuery.toLowerCase()));
    return matchesSearch;
  });

  const getStockStatus = (stock: number) => {
    if (stock === 0) {
      return {
        style: 'bg-rose-50 text-rose-700 border-rose-200',
        text: 'Out of Stock',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
      };
    } else if (stock <= 5) {
      return {
        style: 'bg-amber-50 text-amber-700 border-amber-200',
        text: 'Low Stock',
        icon: <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
      };
    } else {
      return {
        style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: 'In Stock',
        icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
      };
    }
  };

  const getCategoryLabel = (cat: string | null) => {
    switch (cat) {
      case 'PROTEIN': return 'Proteins & Gainers';
      case 'CREATINE': return 'Creatine & Strength';
      case 'PREWORKOUT': return 'Pre-Workout Energizers';
      case 'VITAMINS': return 'Vitamins & Minerals';
      default: return 'Other Supplements';
    }
  };

  const getSaleTypeStyle = (type: string) => {
    switch (type) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'FREE_WITH_SUBSCRIPTION':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'ADDITIONAL_CHARGED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gym-text tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="h-7 w-7 text-gym-secondary" />
            Supplements & Nutrition
          </h1>
          <p className="text-sm text-gym-muted font-medium mt-1">
            Manage front-desk supplement sales, proteins, pre-workouts, and track retail checkout.
          </p>
        </div>

        {isAuthorized && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(activeTab === 'inventory' ? 'sales' : 'inventory')}
              className="flex items-center justify-center gap-2 px-5 py-3 border border-slate-200 bg-white text-gym-text font-bold text-xs rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
            >
              {activeTab === 'inventory' ? (
                <>
                  <History className="h-4 w-4 text-gym-muted" /> Sales History Logs
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 text-gym-muted" /> Product Inventory
                </>
              )}
            </button>
            {activeTab === 'inventory' && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-gym-primary text-black font-bold text-xs rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-gym-primary/20"
              >
                <Plus className="h-4 w-4" /> Add Supplement
              </button>
            )}
          </div>
        )}
      </div>

      {/* TABS VIEW */}
      {activeTab === 'inventory' ? (
        <>
          {/* Stats counter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Total Products</p>
                <h3 className="text-2xl font-black text-gym-text mt-1">{supplements.length}</h3>
              </div>
              <div className="p-3 bg-gym-secondary/10 text-gym-secondary rounded-xl">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Low Stock Alerts</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">
                  {supplements.filter(s => s.stock > 0 && s.stock <= 5).length}
                </h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gym-muted">Out of Stock</p>
                <h3 className="text-2xl font-black text-rose-600 mt-1">
                  {supplements.filter(s => s.stock === 0).length}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Filter and Search controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gym-muted" />
              <input
                type="text"
                placeholder="Search supplements by product name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-gym-text text-sm focus:outline-none focus:border-gym-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-gym-text text-sm focus:outline-none focus:border-gym-primary cursor-pointer"
            >
              <option value="">All Categories</option>
              <option value="PROTEIN">Proteins & Gainers</option>
              <option value="CREATINE">Creatine & Strength</option>
              <option value="PREWORKOUT">Pre-Workout Energizers</option>
              <option value="VITAMINS">Vitamins & Minerals</option>
              <option value="OTHER">Other</option>
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
          ) : filteredSupplements.length === 0 ? (
            <div className="glass-card text-center py-16 rounded-3xl border border-slate-100">
              <ShoppingBag className="h-12 w-12 mx-auto text-gym-muted/60" />
              <h3 className="text-lg font-bold text-gym-text mt-4">No products found</h3>
              <p className="text-xs text-gym-muted mt-1 max-w-sm mx-auto">
                Try adjusting your search queries or adding new supplements to the store.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSupplements.map((supp) => {
                const stockConfig = getStockStatus(supp.stock);
                return (
                  <div
                    key={supp.id}
                    className="glass-card rounded-2xl border border-slate-100 p-5 space-y-4 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold text-gym-secondary uppercase tracking-wider bg-gym-secondary/5 px-2 py-0.5 rounded border border-gym-secondary/10">
                            {supp.category || 'OTHER'}
                          </span>
                          <h3 className="font-extrabold text-gym-text text-base leading-snug mt-2">{supp.name}</h3>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold uppercase shrink-0 ${stockConfig.style}`}>
                          {stockConfig.icon}
                          {stockConfig.text}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gym-muted font-bold block uppercase tracking-wide text-[9px]">Retail Price</span>
                          <span className="font-black text-gym-text text-base">₹{supp.price}</span>
                        </div>
                        <div>
                          <span className="text-gym-muted font-bold block uppercase tracking-wide text-[9px]">Stock Level</span>
                          <span className={`font-extrabold text-sm ${supp.stock === 0 ? 'text-rose-600' : 'text-gym-text'}`}>
                            {supp.stock} Items
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-gym-muted border-t border-slate-50 pt-2 flex items-center justify-between font-semibold">
                        <span>Category: {getCategoryLabel(supp.category)}</span>
                        <span className="text-slate-400">Branch: {supp.branch.name}</span>
                      </div>

                      {supp.description && (
                        <div className="text-xs text-gym-muted bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          {supp.description}
                        </div>
                      )}
                    </div>

                    {isAuthorized && (
                      <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                        {supp.stock > 0 ? (
                          <button
                            onClick={() => handleOpenSell(supp)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gym-primary text-black font-extrabold text-xs rounded-xl hover:opacity-90 transition-all shadow-md shadow-gym-primary/10"
                          >
                            <Tag className="h-3.5 w-3.5" /> Sell Product Checkout
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-400 font-extrabold text-xs rounded-xl cursor-not-allowed border border-slate-200"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" /> Product Out of Stock
                          </button>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenEdit(supp)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-slate-200 hover:border-gym-primary text-gym-text hover:text-gym-primary text-xs font-bold rounded-xl transition-all"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> Edit Details
                          </button>
                          <button
                            onClick={() => handleDelete(supp.id)}
                            className="px-3 py-2 border border-rose-200 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* SALES LOGS TAB */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gym-muted" />
              <input
                type="text"
                placeholder="Search sales logs by member name, product, or notes..."
                value={salesSearchQuery}
                onChange={(e) => setSalesSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-gym-text text-sm focus:outline-none focus:border-gym-primary"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-4 border-gym-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="glass-card text-center py-16 rounded-3xl border border-slate-100">
              <History className="h-12 w-12 mx-auto text-gym-muted/60" />
              <h3 className="text-lg font-bold text-gym-text mt-4">No sales records registered</h3>
              <p className="text-xs text-gym-muted mt-1 max-w-sm mx-auto">
                Supplement sales checkout logs will appear here once recorded.
              </p>
            </div>
          ) : (
            <div className="glass-card rounded-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-gym-muted">
                      <th className="py-4 px-6">Sale Date</th>
                      <th className="py-4 px-6">Member Name</th>
                      <th className="py-4 px-6">Supplement Product</th>
                      <th className="py-4 px-6 text-center">Qty</th>
                      <th className="py-4 px-6 text-right">Sold At</th>
                      <th className="py-4 px-6 text-center">Billing Type</th>
                      <th className="py-4 px-6">Notes / Comments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gym-text">
                          {new Date(sale.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 font-extrabold text-gym-text">
                          {sale.member.user.firstName} {sale.member.user.lastName}
                        </td>
                        <td className="py-4 px-6 font-bold text-gym-text">
                          {sale.supplement.name}
                        </td>
                        <td className="py-4 px-6 text-center font-extrabold text-slate-700">
                          {sale.quantity}
                        </td>
                        <td className="py-4 px-6 text-right font-black text-gym-text">
                          ₹{sale.soldPrice}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded border text-[9px] font-extrabold uppercase ${getSaleTypeStyle(sale.saleType)}`}>
                            {sale.saleType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gym-muted italic max-w-xs truncate">
                          {sale.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. ADD SUPPLEMENT MODAL */}
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
                <h3 className="font-extrabold text-base text-gym-text">Add New Product</h3>
                <p className="text-xs text-gym-muted">Add proteins, vitamins, mass gainers, or energy bars.</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimum Nutrition Whey 2kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    className="gym-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    <option value="PROTEIN">Proteins & Gainers</option>
                    <option value="CREATINE">Creatine & Strength</option>
                    <option value="PREWORKOUT">Pre-Workout Energizers</option>
                    <option value="VITAMINS">Vitamins & Minerals</option>
                    <option value="OTHER">Other</option>
                  </select>
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
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Description</label>
                <textarea
                  placeholder="Describe flavors, nutritional facts, serving sizes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="gym-input"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3 bg-gym-primary hover:opacity-90 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {actionLoading ? 'Saving...' : 'Add Supplement'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. EDIT SUPPLEMENT MODAL */}
      {showEditModal && activeSupplement && (
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
                <h3 className="font-extrabold text-base text-gym-text">Edit Product Inventory</h3>
                <p className="text-xs text-gym-muted">Modify price, descriptions, or change stock levels.</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optimum Nutrition Whey 2kg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Stock Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={stock}
                    onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                    className="gym-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    <option value="PROTEIN">Proteins & Gainers</option>
                    <option value="CREATINE">Creatine & Strength</option>
                    <option value="PREWORKOUT">Pre-Workout Energizers</option>
                    <option value="VITAMINS">Vitamins & Minerals</option>
                    <option value="OTHER">Other</option>
                  </select>
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
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Description</label>
                <textarea
                  placeholder="Describe flavors, nutritional facts, serving sizes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

      {/* 4. SELL CHECKOUT MODAL */}
      {showSellModal && activeSupplement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-slate-200 space-y-5 relative">
            <button
              onClick={() => setShowSellModal(false)}
              className="absolute right-4 top-4 p-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 text-gym-muted hover:text-gym-text"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-gym-primary/20 text-gym-primary rounded-xl">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gym-text">Supplement Sale Checkout</h3>
                <p className="text-xs text-gym-muted">Sell <strong>{activeSupplement.name}</strong> to a member (Stock: {activeSupplement.stock}).</p>
              </div>
            </div>

            <form onSubmit={handleSellSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Select Gym Member</label>
                {members.length === 0 ? (
                  <div className="text-xs text-rose-500 font-semibold p-2 border border-rose-200 bg-rose-50 rounded-lg">
                    No members are registered at this branch location to sell supplements to.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.user.firstName} {m.user.lastName} ({m.user.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={activeSupplement.stock}
                    required
                    value={sellQuantity}
                    onChange={(e) => setSellQuantity(Math.min(activeSupplement.stock, parseInt(e.target.value) || 1))}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Sale Billing Mode</label>
                  <select
                    value={saleType}
                    onChange={(e) => setSaleType(e.target.value)}
                    className="gym-input cursor-pointer"
                  >
                    <option value="PAID">Paid Checkout</option>
                    <option value="FREE_WITH_SUBSCRIPTION">Free with subscription</option>
                    <option value="ADDITIONAL_CHARGED">Additional Charged</option>
                  </select>
                </div>
              </div>

              {saleType !== 'FREE_WITH_SUBSCRIPTION' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Unit Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={sellPrice}
                    onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                    className="gym-input"
                  />
                </div>
              )}

              {saleType === 'FREE_WITH_SUBSCRIPTION' && (
                <div className="text-xs bg-sky-50 text-sky-700 border border-sky-200 p-3 rounded-xl font-bold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-sky-600" />
                  <span>Cost set to ₹0 as the product is given free with membership!</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Total Amount</label>
                <div className="text-lg font-black text-gym-text bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
                  ₹{saleType === 'FREE_WITH_SUBSCRIPTION' ? 0 : (sellPrice * sellQuantity).toFixed(2)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gym-muted mb-1.5">Notes / Billing Info</label>
                <textarea
                  placeholder="Record order numbers, custom descriptions..."
                  value={sellNotes}
                  onChange={(e) => setSellNotes(e.target.value)}
                  rows={2}
                  className="gym-input"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={actionLoading || members.length === 0}
                className="w-full py-3 bg-gym-primary hover:opacity-90 text-black font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                {actionLoading ? 'Recording Transaction...' : 'Process Supplement Sale'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
