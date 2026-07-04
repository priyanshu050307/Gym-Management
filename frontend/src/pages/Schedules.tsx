import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import {
  Calendar,
  Users,
  UserPlus,
  PlusCircle,
  Trash2,
  Edit2,
  Clock,
  Search,
  X,
  Plus,
  Loader2,
  Star
} from 'lucide-react';

interface Trainer {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  user?: {
    id: string;
    branchId?: string | null;
    branch?: {
      name: string;
    } | null;
  } | null;
}

interface MemberSummary {
  id: string;
  status: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Booking {
  id: string;
  memberId: string;
  member: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  bookedAt: string;
  status: string;
}

interface GroupClass {
  id: string;
  name: string;
  description?: string;
  trainerId: string;
  trainer: Trainer;
  dateTime: string;
  durationMinutes: number;
  capacity: number;
  bookings: Booking[];
}

export const Schedules: React.FC = () => {
  const { user, activeBranchId, branches } = useAuth();
  // Navigation tabs: 'schedule' | 'trainers' | 'manage'
  const [activeTab, setActiveTab] = useState<'schedule' | 'trainers' | 'manage'>('schedule');

  // Loaded states
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [classes, setClasses] = useState<GroupClass[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayedClasses = user?.role === 'TRAINER'
    ? classes.filter(c => c.trainerId === user.trainer?.id || c.trainer?.user?.id === user.id)
    : classes;

  // Forms state: Add/Edit Trainer
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [trainerForm, setTrainerForm] = useState({
    firstName: '',
    lastName: '',
    specialty: '',
    email: '',
    phone: '',
    isActive: true,
    branchId: ''
  });
  const [trainerFormSubmitting, setTrainerFormSubmitting] = useState(false);

  // Forms state: Add/Edit Class
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<GroupClass | null>(null);
  const [classForm, setClassForm] = useState({
    name: '',
    description: '',
    trainerId: '',
    dateTime: '',
    durationMinutes: '60',
    capacity: '20'
  });
  const [classFormSubmitting, setClassFormSubmitting] = useState(false);

  // Booking Modal State
  const [selectedClassForBooking, setSelectedClassForBooking] = useState<GroupClass | null>(null);
  const [bookingMemberId, setBookingMemberId] = useState('');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Trainer Feedback Reviews Modal State
  const [feedbackTrainer, setFeedbackTrainer] = useState<Trainer | null>(null);
  const [feedbackLogs, setFeedbackLogs] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const handleViewFeedback = async (trainer: Trainer) => {
    setFeedbackTrainer(trainer);
    setLoadingFeedback(true);
    try {
      const data = await apiFetch<any>(`/trainers/${trainer.id}/feedback`);
      setFeedbackLogs(data.reviews || []);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch reviews');
    } finally {
      setLoadingFeedback(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all trainers, classes and members (for booking selections)
      const trainersData = await apiFetch<{ trainers: Trainer[] }>('/trainers');
      const classesData = await apiFetch<{ classes: GroupClass[] }>('/classes');
      const membersData = await apiFetch<{ members: MemberSummary[] }>('/members');

      setTrainers(trainersData.trainers);
      setClasses(classesData.classes);
      setMembers(membersData.members);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeBranchId]);

  // Sync selected class data in booking modal when classes state changes
  useEffect(() => {
    if (selectedClassForBooking) {
      const updatedClass = classes.find(c => c.id === selectedClassForBooking.id);
      if (updatedClass) {
        setSelectedClassForBooking(updatedClass);
      }
    }
  }, [classes]);

  // Trainer Handlers
  const handleOpenTrainerAdd = () => {
    setEditingTrainer(null);
    setTrainerForm({
      firstName: '',
      lastName: '',
      specialty: '',
      email: '',
      phone: '',
      isActive: true,
      branchId: activeBranchId || (branches.length > 0 ? branches[0].id : '')
    });
    setShowTrainerModal(true);
  };

  const handleOpenTrainerEdit = (trainer: Trainer) => {
    setEditingTrainer(trainer);
    setTrainerForm({
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      specialty: trainer.specialty,
      email: trainer.email || '',
      phone: trainer.phone || '',
      isActive: trainer.isActive,
      branchId: trainer.user?.branchId || ''
    });
    setShowTrainerModal(true);
  };

  const handleTrainerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainerForm.firstName || !trainerForm.lastName || !trainerForm.specialty) return;

    if (trainerForm.phone && !/^\d{10}$/.test(trainerForm.phone)) {
      alert('Trainer phone number must be exactly 10 digits.');
      return;
    }

    if (trainerForm.email && !trainerForm.email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    setTrainerFormSubmitting(true);
    try {
      if (editingTrainer) {
        await apiFetch(`/trainers/${editingTrainer.id}`, {
          method: 'PUT',
          body: trainerForm,
        });
      } else {
        await apiFetch('/trainers', {
          method: 'POST',
          body: trainerForm,
        });
      }
      setShowTrainerModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error saving trainer details');
    } finally {
      setTrainerFormSubmitting(false);
    }
  };

  const handleTrainerDelete = async (trainerId: string) => {
    if (!confirm('Are you sure you want to delete this trainer?')) return;
    try {
      await apiFetch(`/trainers/${trainerId}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete trainer');
    }
  };

  // Class Handlers
  const handleOpenClassAdd = () => {
    setEditingClass(null);
    setClassForm({
      name: '',
      description: '',
      trainerId: trainers.length > 0 ? trainers[0].id : '',
      dateTime: '',
      durationMinutes: '60',
      capacity: '20'
    });
    setShowClassModal(true);
  };

  const handleOpenClassEdit = (gClass: GroupClass) => {
    setEditingClass(gClass);
    // Format ISO string to local datetime-local input value (YYYY-MM-DDThh:mm)
    const localDt = new Date(gClass.dateTime);
    const tzOffset = localDt.getTimezoneOffset() * 60000;
    const localISOTime = new Date(localDt.getTime() - tzOffset).toISOString().slice(0, 16);

    setClassForm({
      name: gClass.name,
      description: gClass.description || '',
      trainerId: gClass.trainerId,
      dateTime: localISOTime,
      durationMinutes: gClass.durationMinutes.toString(),
      capacity: gClass.capacity.toString()
    });
    setShowClassModal(true);
  };

  const handleClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.name || !classForm.trainerId || !classForm.dateTime) return;

    setClassFormSubmitting(true);
    try {
      if (editingClass) {
        await apiFetch(`/classes/${editingClass.id}`, {
          method: 'PUT',
          body: classForm,
        });
      } else {
        await apiFetch('/classes', {
          method: 'POST',
          body: classForm,
        });
      }
      setShowClassModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error scheduling class');
    } finally {
      setClassFormSubmitting(false);
    }
  };

  const handleClassDelete = async (classId: string) => {
    if (!confirm('Are you sure you want to remove this class session from the calendar?')) return;
    try {
      await apiFetch(`/classes/${classId}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete class session');
    }
  };

  // Class Booking Actions
  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassForBooking || !bookingMemberId) return;

    setBookingLoading(true);
    setBookingError(null);
    try {
      await apiFetch('/bookings', {
        method: 'POST',
        body: {
          classId: selectedClassForBooking.id,
          memberId: bookingMemberId
        }
      });
      setBookingMemberId('');
      setBookingSearchQuery('');
      
      // Reload schedule state
      const classesData = await apiFetch<{ classes: GroupClass[] }>('/classes');
      setClasses(classesData.classes);
    } catch (err: any) {
      setBookingError(err.message || 'Failed to create class booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (memberId: string) => {
    if (!selectedClassForBooking) return;
    if (!confirm('Are you sure you want to cancel registration for this member?')) return;

    try {
      await apiFetch('/bookings/cancel', {
        method: 'POST',
        body: {
          classId: selectedClassForBooking.id,
          memberId
        }
      });
      // Reload schedule state
      const classesData = await apiFetch<{ classes: GroupClass[] }>('/classes');
      setClasses(classesData.classes);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    }
  };

  // Filter members for booking input
  const filteredMembers = members.filter(m => {
    const fullName = `${m.user.firstName} ${m.user.lastName}`.toLowerCase();
    const query = bookingSearchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      m.user.email.toLowerCase().includes(query) ||
      m.id.includes(query)
    ) && m.status === 'ACTIVE'; // Only active membership bookings allowed
  });

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gym-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <Calendar className="h-8 w-8 text-gym-primary" />
            Class Schedules & Bookings
          </h1>
          <p className="text-gym-muted mt-1">
            Build group training times, schedule fitness classes, and manage booking rosters.
          </p>
        </div>

        {/* Tab Controllers */}
        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0 self-start">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'schedule' ? 'bg-gym-primary text-white' : 'text-gym-muted hover:text-gym-text'
            }`}
          >
            Weekly Schedule
          </button>
          <button
            onClick={() => setActiveTab('trainers')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'trainers' ? 'bg-gym-primary text-white' : 'text-gym-muted hover:text-gym-text'
            }`}
          >
            Trainer Roster
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'schedule' ? (
        <div className="space-y-6">
          {/* Schedule Utilities */}
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs text-gym-muted font-medium uppercase tracking-wider">
              {displayedClasses.length} Sessions Scheduled
            </span>
            {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
              <button
                onClick={handleOpenClassAdd}
                className="px-4 py-2 bg-gym-primary hover:bg-gym-primary/80 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                Schedule Class
              </button>
            )}
          </div>

          {/* Classes Listing */}
          {displayedClasses.length === 0 ? (
            <div className="glass-card rounded-2xl border border-slate-100 p-16 text-center text-gym-muted italic">
              {user?.role === 'TRAINER'
                ? 'No classes scheduled for you yet.'
                : 'No classes scheduled yet. Click "Schedule Class" to schedule group fitness lessons.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedClasses.map((gClass) => {
                const dateObj = new Date(gClass.dateTime);
                const dayName = dateObj.toLocaleDateString([], { weekday: 'long' });
                const dateString = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' });
                const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const bookedCount = gClass.bookings.length;
                const percentFull = Math.min((bookedCount / gClass.capacity) * 100, 100);

                return (
                  <div
                    key={gClass.id}
                    className="glass-card rounded-2xl border border-slate-100 p-6 space-y-4 hover:border-gym-primary/20 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Class timing badge */}
                      <div className="flex justify-between items-start">
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-gym-primary/10 text-gym-primary border border-gym-primary/20">
                          {dayName}, {dateString}
                        </span>
                        {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleOpenClassEdit(gClass)}
                              className="p-1.5 hover:bg-slate-50 rounded-lg text-gym-muted hover:text-gym-text transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleClassDelete(gClass.id)}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-gym-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <h3 className="font-extrabold text-gym-text text-lg leading-tight">{gClass.name}</h3>
                        <p className="text-gym-muted text-xs mt-1 line-clamp-2">{gClass.description || 'No class description provided.'}</p>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium text-gym-muted">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gym-secondary" />
                          <span>{timeString} ({gClass.durationMinutes}m)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Coach {gClass.trainer.firstName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Booking Progress gauge */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-gym-muted">Roster Capacity</span>
                        <span className={bookedCount >= gClass.capacity ? 'text-red-400 font-extrabold' : 'text-gym-text'}>
                          {bookedCount} / {gClass.capacity} slots filled
                        </span>
                      </div>
                      <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            bookedCount >= gClass.capacity ? 'bg-red-500' : 'bg-gym-secondary'
                          }`}
                          style={{ width: `${percentFull}%` }}
                        ></div>
                      </div>

                      {/* Book member button */}
                      <button
                        onClick={() => setSelectedClassForBooking(gClass)}
                        className="w-full mt-3 py-2.5 bg-gym-primary/10 hover:bg-gym-primary text-gym-primary hover:text-white border border-gym-primary/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        {user?.role === 'TRAINER' ? (
                          <Users className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        {user?.role === 'TRAINER' ? 'View Attendee Roster' : 'Manage Roster & Bookings'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Trainers Tab Roster View */
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs text-gym-muted font-medium uppercase tracking-wider">
              {trainers.length} Trainers Enrolled
            </span>
            {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
              <button
                onClick={handleOpenTrainerAdd}
                className="px-4 py-2 bg-gym-primary hover:bg-gym-primary/80 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                Add Trainer
              </button>
            )}
          </div>

          {trainers.length === 0 ? (
            <div className="glass-card rounded-2xl border border-slate-100 p-16 text-center text-gym-muted italic">
              No trainers registered. Click "Add Trainer" to add fitness instructors.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trainers.map((trainer) => (
                <div
                  key={trainer.id}
                  className="glass-card rounded-2xl border border-slate-100 p-6 flex flex-col justify-between hover:border-gym-primary/20 transition-all relative overflow-hidden group"
                >
                  <div className="space-y-4">
                    {/* Status badge */}
                    <div className="flex justify-between items-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          trainer.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-50 text-gym-muted border border-slate-200'
                        }`}
                      >
                        {trainer.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenTrainerEdit(trainer)}
                            className="p-1.5 hover:bg-slate-50 rounded-lg text-gym-muted hover:text-gym-text transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleTrainerDelete(trainer.id)}
                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-gym-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-gym-text text-base truncate">
                        {trainer.firstName} {trainer.lastName}
                      </h3>
                      <div className="flex gap-1.5 flex-wrap">
                        <span className="inline-flex px-2.5 py-0.5 bg-gym-secondary/15 text-gym-secondary text-[10px] font-bold rounded-lg border border-gym-secondary/10">
                          {trainer.specialty}
                        </span>
                        {trainer.user?.branch?.name && (
                          <span className="inline-flex px-2.5 py-0.5 bg-gym-primary/10 text-gym-primary text-[10px] font-bold rounded-lg border border-gym-primary/25">
                            {trainer.user.branch.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Contact info details */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-gym-muted">
                      <p className="font-mono truncate">{trainer.email || 'No email registered'}</p>
                      <p className="font-mono">{trainer.phone || 'No phone registered'}</p>
                      
                      {/* Ratings scoreboard */}
                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-50 mt-1">
                        <Star className="h-3.5 w-3.5 text-gym-secondary fill-gym-secondary" />
                        <span className="text-xs font-bold text-gym-text">
                          {(trainer as any).averageRating > 0 ? (trainer as any).averageRating : 'No Rating'}
                        </span>
                        <span className="text-[10px] text-gym-muted">
                          ({(trainer as any).feedbackCount || 0} reviews)
                        </span>
                        {((trainer as any).feedbackCount || 0) > 0 && (
                          <button
                            onClick={() => handleViewFeedback(trainer)}
                            className="text-[10px] text-gym-primary hover:underline font-bold ml-auto"
                          >
                            View Reviews
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TRAINER ADD/EDIT DIALOG MODAL */}
      {showTrainerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gym-card border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowTrainerModal(false)}
              className="absolute top-4 right-4 text-gym-muted hover:text-gym-text"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-4 text-gym-text">
              {editingTrainer ? 'Modify Trainer Details' : 'Register New Trainer'}
            </h3>

            <form onSubmit={handleTrainerSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">First Name</label>
                  <input
                    type="text"
                    required
                    value={trainerForm.firstName}
                    onChange={(e) => setTrainerForm({ ...trainerForm, firstName: e.target.value })}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Last Name</label>
                  <input
                    type="text"
                    required
                    value={trainerForm.lastName}
                    onChange={(e) => setTrainerForm({ ...trainerForm, lastName: e.target.value })}
                    className="gym-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Specialty Specialty</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CrossFit, Yoga, Zumba, Cardio"
                  value={trainerForm.specialty}
                  onChange={(e) => setTrainerForm({ ...trainerForm, specialty: e.target.value })}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={trainerForm.email}
                  onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={trainerForm.phone}
                  onChange={(e) => setTrainerForm({ ...trainerForm, phone: e.target.value })}
                  className="gym-input"
                />
              </div>

              {user?.role === 'ADMIN' ? (
                branches.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Branch Assignment</label>
                    <select
                      value={trainerForm.branchId}
                      onChange={(e) => setTrainerForm({ ...trainerForm, branchId: e.target.value })}
                      className="gym-input"
                    >
                      <option value="">Select Branch...</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Branch</label>
                  <p className="text-xs font-bold text-gym-text bg-slate-900/50 p-2.5 rounded-lg border border-slate-100/5">
                    {branches.find(b => b.id === trainerForm.branchId)?.name || 'Home Branch'}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="trainer-active"
                  checked={trainerForm.isActive}
                  onChange={(e) => setTrainerForm({ ...trainerForm, isActive: e.target.checked })}
                  className="rounded bg-gym-darker border-slate-200 text-gym-primary focus:ring-0"
                />
                <label htmlFor="trainer-active" className="text-xs text-gym-text font-semibold">
                  Trainer is currently active
                </label>
              </div>

              <button
                type="submit"
                disabled={trainerFormSubmitting}
                className="w-full py-3 bg-gym-primary hover:bg-gym-primary/80 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm mt-4 flex items-center justify-center gap-2"
              >
                {trainerFormSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingTrainer ? 'Save Changes' : 'Add Trainer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLASS ADD/EDIT DIALOG MODAL */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gym-card border border-slate-200 rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setShowClassModal(false)}
              className="absolute top-4 right-4 text-gym-muted hover:text-gym-text"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-4 text-gym-text">
              {editingClass ? 'Modify Class Schedule' : 'Schedule Group Fitness Class'}
            </h3>

            <form onSubmit={handleClassSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Class Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Saturday Yoga, Morning Lift"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Description</label>
                <textarea
                  placeholder="Provide details of the workout session..."
                  value={classForm.description}
                  onChange={(e) => setClassForm({ ...classForm, description: e.target.value })}
                  className="gym-input h-20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Instructor Coach</label>
                <select
                  required
                  value={classForm.trainerId}
                  onChange={(e) => setClassForm({ ...classForm, trainerId: e.target.value })}
                  className="gym-input"
                >
                  <option value="" disabled>Select a trainer...</option>
                  {trainers.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.specialty})
                    </option>
                  ))}
                </select>
                {trainers.filter(t => t.isActive).length === 0 && (
                  <p className="text-[10px] text-amber-400 mt-1">No active trainers available. Register one first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={classForm.dateTime}
                    onChange={(e) => setClassForm({ ...classForm, dateTime: e.target.value })}
                    className="gym-input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Duration (minutes)</label>
                  <input
                    type="number"
                    required
                    min="10"
                    value={classForm.durationMinutes}
                    onChange={(e) => setClassForm({ ...classForm, durationMinutes: e.target.value })}
                    className="gym-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase mb-1.5">Roster capacity limit</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={classForm.capacity}
                  onChange={(e) => setClassForm({ ...classForm, capacity: e.target.value })}
                  className="gym-input"
                />
              </div>

              <button
                type="submit"
                disabled={classFormSubmitting || trainers.filter(t => t.isActive).length === 0}
                className="w-full py-3 bg-gym-primary hover:bg-gym-primary/80 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm mt-4 flex items-center justify-center gap-2"
              >
                {classFormSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingClass ? 'Update Class' : 'Schedule Class'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ROSTER BOOKINGS SIDEBAR/MODAL DRAWER */}
      {selectedClassForBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md h-full bg-gym-card border-l border-slate-200 flex flex-col justify-between p-6 relative animate-slide-in">
            <div>
              <button
                onClick={() => {
                  setSelectedClassForBooking(null);
                  setBookingError(null);
                }}
                className="absolute top-4 right-4 text-gym-muted hover:text-gym-text"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-2 mt-4 mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gym-secondary">
                  Class Enrolments
                </span>
                <h3 className="text-xl font-extrabold text-gym-text">
                  {selectedClassForBooking.name}
                </h3>
                <p className="text-xs text-gym-muted font-semibold">
                  Trainer: {selectedClassForBooking.trainer.firstName} {selectedClassForBooking.trainer.lastName}
                </p>
                <p className="text-xs text-gym-muted">
                  Schedule: {new Date(selectedClassForBooking.dateTime).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </p>
              </div>

              {bookingError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4">
                  {bookingError}
                </div>
              )}

              {/* Booking search bar adder */}
              {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                <form onSubmit={handleAddBooking} className="space-y-3 pb-6 border-b border-slate-100">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search member name or ID..."
                      value={bookingSearchQuery}
                      onChange={(e) => {
                        setBookingSearchQuery(e.target.value);
                        setBookingError(null);
                      }}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-gym-text placeholder-gym-muted text-xs focus:border-gym-primary focus:outline-none"
                    />
                    <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-gym-muted" />
                  </div>

                  {bookingSearchQuery.trim() !== '' && (
                    <div className="bg-gym-darker border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-200">
                      {filteredMembers.length === 0 ? (
                        <div className="p-3 text-[11px] text-gym-muted text-center italic">
                          No active members found matching query
                        </div>
                      ) : (
                        filteredMembers.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setBookingMemberId(m.id);
                              setBookingSearchQuery(`${m.user.firstName} ${m.user.lastName}`);
                            }}
                            className={`w-full p-2.5 text-left text-xs transition-colors flex items-center justify-between hover:bg-slate-50 ${
                              bookingMemberId === m.id ? 'bg-gym-primary/10 text-gym-primary font-bold' : 'text-gym-text'
                            }`}
                          >
                            <div>
                              <div>{m.user.firstName} {m.user.lastName}</div>
                              <div className="text-[10px] text-gym-muted font-mono">{m.id.substring(0, 8)}...</div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                              {m.status}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading || !bookingMemberId}
                    className="w-full py-2.5 bg-gym-primary hover:bg-gym-primary/80 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    {bookingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Register Member in Roster
                  </button>
                </form>
              )}

              {/* Roster list */}
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-semibold text-gym-muted uppercase tracking-wider">
                  Registered Attendees ({selectedClassForBooking.bookings.length} / {selectedClassForBooking.capacity})
                </h4>

                {selectedClassForBooking.bookings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gym-muted italic">
                    No members registered in this class yet.
                  </div>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto pr-1 divide-y divide-slate-200">
                    {selectedClassForBooking.bookings.map(booking => (
                      <div key={booking.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-gym-text">
                            {booking.member.user.firstName} {booking.member.user.lastName}
                          </div>
                          <div className="text-[10px] text-gym-muted font-mono">
                            {booking.member.id}
                          </div>
                        </div>
                        {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                          <button
                            onClick={() => handleCancelBooking(booking.memberId)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition-all border border-red-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedClassForBooking(null);
                setBookingError(null);
              }}
              className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-gym-text border border-slate-200 font-semibold rounded-xl text-xs transition-all mt-6"
            >
              Close Roster Drawer
            </button>
          </div>
        </div>
      )}
      {/* TRAINER FEEDBACK REVIEWS MODAL */}
      {feedbackTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-gym-card border border-slate-200 rounded-2xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
            <button
              onClick={() => setFeedbackTrainer(null)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-50 rounded-lg text-gym-muted hover:text-gym-text transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-1 mb-4">
              <h3 className="font-extrabold text-lg text-gym-text">
                Feedback Scorecard: {feedbackTrainer.firstName} {feedbackTrainer.lastName}
              </h3>
              <p className="text-xs text-gym-muted">Reviews and feedback comments submitted by members.</p>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-4 pt-2 divide-y divide-slate-100">
              {loadingFeedback ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gym-primary" />
                </div>
              ) : feedbackLogs.length === 0 ? (
                <div className="py-12 text-center text-sm text-gym-muted italic">
                  No member reviews logged yet.
                </div>
              ) : (
                feedbackLogs.map((log) => (
                  <div key={log.id} className="pt-3 space-y-1.5 first:pt-0 first:border-0 border-t border-slate-50">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-gym-text">
                        {log.member.user.firstName} {log.member.user.lastName}
                      </span>
                      <span className="text-[10px] text-gym-muted font-mono">
                        {new Date(log.submittedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3.5 w-3.5 ${
                            star <= log.rating
                              ? 'text-gym-secondary fill-gym-secondary'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>

                    {log.feedback && (
                      <p className="text-xs text-gym-text leading-relaxed bg-slate-900/10 p-2.5 rounded-lg italic">
                        "{log.feedback}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setFeedbackTrainer(null)}
              className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-gym-text border border-slate-200 font-semibold rounded-xl text-xs transition-all mt-6"
            >
              Close Scorecard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
