import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Camera, 
  Lock, 
  MapPin, 
  Star, 
  MessageSquare,
  Award,
  Calendar,
  AlertCircle,
  Building,
  CheckCircle2
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  rating: number;
  comment: string | null;
  feedback: string | null;
  createdAt: string;
  member: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  trainer: {
    firstName: string;
    lastName: string;
    specialty: string;
  };
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=150&q=80', // Gym guy
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=150&q=80', // Gym girl
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80', // Athlete man
  'https://images.unsplash.com/photo-1548690312-e3b507d8c110?auto=format&fit=crop&w=150&q=80', // Athlete woman
];

export const Profile: React.FC = () => {
  const { user, login } = useAuth();
  
  // Form states
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  
  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);

  // Sync profile data on load
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setEmail(user.email);
      setPhoneNumber(user.phoneNumber || '');
      setProfilePhoto(user.profilePhoto || '');
    }
  }, [user]);

  // Fetch admin recent feedbacks
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const fetchFeedbacks = async () => {
        try {
          setFeedbacksLoading(true);
          const data = await apiFetch<any>('/auth/feedbacks');
          setFeedbacks(data.feedbacks || []);
        } catch (err: any) {
          console.error('Failed to fetch branch feedbacks:', err);
        } finally {
          setFeedbacksLoading(false);
        }
      };
      fetchFeedbacks();
    }
  }, [user]);

  // Handle file selection (Base64 conversion)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit profile updates
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<any>('/auth/profile', {
        method: 'PUT',
        body: {
          firstName,
          lastName,
          email,
          phoneNumber,
          profilePhoto,
        },
      });

      setSuccess('Profile updated successfully!');
      
      // Update local storage / auth context state
      const token = localStorage.getItem('gymos_token');
      if (token) {
        // Fetch fresh profile data to sync context
        const freshProfile = await apiFetch<any>('/auth/me');
        login(token, freshProfile.user);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  // Submit password updates
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiFetch<any>('/auth/reset-password', {
        method: 'POST',
        body: {
          token: currentPassword, // Using current password as verification token in mock/impl
          newPassword,
        },
      });
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-gym-text">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gym-secondary">My Profile</h1>
          <p className="text-gym-muted text-sm mt-1">Manage your identity, secure credentials, and view role analytics.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-start gap-3 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Personal info form */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="glass-card rounded-2xl border border-slate-100 p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-gym-secondary flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-gym-primary" />
              Personal Information
            </h2>
            
            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="gym-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 h-4.5 w-4.5 text-gym-muted" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="gym-input pl-11"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 h-4.5 w-4.5 text-gym-muted" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    className="gym-input pl-11"
                  />
                </div>
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3.5 bg-gym-primary hover:bg-gym-primary/95 text-white font-extrabold rounded-xl text-sm transition-all shadow-md shadow-gym-primary/15 hover:scale-[1.02] cursor-pointer"
                >
                  {loading ? 'Saving updates...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password settings */}
          <div className="glass-card rounded-2xl border border-slate-100 p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-gym-secondary flex items-center gap-2">
              <Lock className="h-5 w-5 text-gym-primary" />
              Security & Credentials
            </h2>
            
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="gym-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="gym-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gym-muted uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="gym-input"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3.5 bg-gym-secondary hover:bg-gym-secondary/90 text-white font-extrabold rounded-xl text-sm transition-all cursor-pointer"
                >
                  {loading ? 'Processing...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: Profile Picture & Role Statistics */}
        <div className="space-y-8">
          
          {/* Avatar card */}
          <div className="glass-card rounded-2xl border border-slate-100 p-6 text-center space-y-6">
            <h2 className="text-sm font-bold text-gym-secondary uppercase tracking-wider text-left">Customize Avatar</h2>
            
            <div className="relative w-32 h-32 mx-auto group">
              <img
                src={profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                alt="Profile Avatar"
                className="w-full h-full object-cover rounded-full border-4 border-gym-primary/30 group-hover:opacity-75 transition-all shadow-xl"
              />
              <label className="absolute inset-0 flex items-center justify-center bg-black/55 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all">
                <Camera className="h-6 w-6" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-gym-secondary">{firstName} {lastName}</p>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gym-primary/10 text-gym-primary border border-gym-primary/20">
                {user?.role}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3.5 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Preset Avatars</span>
              <div className="flex gap-3 justify-start">
                {PRESET_AVATARS.map((avatar, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProfilePhoto(avatar)}
                    className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 hover:border-gym-primary transition-all active:scale-95 cursor-pointer"
                  >
                    <img src={avatar} alt="Preset Avatar" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 text-left">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gym-muted mb-2">Custom Image URL</label>
              <input
                type="text"
                value={profilePhoto}
                onChange={(e) => setProfilePhoto(e.target.value)}
                placeholder="Paste direct image link"
                className="gym-input text-xs"
              />
            </div>
          </div>

          {/* Role details block */}
          {user?.role === 'ADMIN' && (
            <div className="glass-card rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building className="h-5 w-5 text-gym-primary" />
                <h3 className="font-bold text-gym-secondary text-sm uppercase tracking-wider">Branch & Feedback</h3>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Gym Branch</p>
                  <p className="text-sm font-bold text-gym-secondary mt-1">{user?.branch?.name || 'Central Headquarter Branch'}</p>
                  <p className="text-xs text-gym-muted flex items-center gap-1.5 mt-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {user?.branch?.address || 'Central Plaza, Suite 402'}
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gym-muted flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-gym-primary" />
                    Recent Member Feedbacks
                  </span>

                  {feedbacksLoading ? (
                    <div className="text-center py-4 text-xs text-gym-muted">Loading feedbacks...</div>
                  ) : feedbacks.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gym-muted italic">No feedbacks registered in this branch.</div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                      {feedbacks.map((f) => (
                        <div key={f.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-gym-secondary">
                              {f.member?.user?.firstName} {f.member?.user?.lastName}
                            </span>
                            <div className="flex gap-0.5 text-amber-500">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className={`h-3 w-3 ${i < f.rating ? 'fill-current' : 'opacity-25'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-gym-muted italic">"{f.feedback || f.comment || 'No comment'}"</p>
                          <div className="text-[9px] text-gym-muted flex justify-between">
                            <span>Trainer: {f.trainer?.firstName} {f.trainer?.lastName}</span>
                            <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {user?.role === 'TRAINER' && (
            <div className="glass-card rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Award className="h-5 w-5 text-gym-primary" />
                <h3 className="font-bold text-gym-secondary text-sm uppercase tracking-wider">Trainer Specialty</h3>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Expertise Tier</p>
                <p className="text-sm font-bold text-gym-secondary mt-1">Crossfit & Power Strength Coaching</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Active Client Allocation</p>
                <p className="text-sm font-bold text-gym-secondary mt-1">12 Members Assigned</p>
              </div>
            </div>
          )}

          {user?.role === 'MEMBER' && (
            <div className="glass-card rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calendar className="h-5 w-5 text-gym-primary" />
                <h3 className="font-bold text-gym-secondary text-sm uppercase tracking-wider">Membership Status</h3>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Member Status</p>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mt-1">
                  Active
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Account Created</p>
                <p className="text-sm font-bold text-gym-secondary mt-1">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          )}

          {user?.role === 'STAFF' && (
            <div className="glass-card rounded-2xl border border-slate-100 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building className="h-5 w-5 text-gym-primary" />
                <h3 className="font-bold text-gym-secondary text-sm uppercase tracking-wider">Assigned Branch</h3>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-gym-muted uppercase font-bold tracking-wider">Workplace Location</p>
                <p className="text-sm font-bold text-gym-secondary mt-1">{user?.branch?.name || 'Central Branch Location'}</p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
