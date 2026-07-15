import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

export type UserRole = 'ADMIN' | 'STAFF' | 'MEMBER' | 'TRAINER';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profilePhoto?: string | null;
  phoneNumber?: string | null;
  createdAt?: string | null;
  branchId?: string | null;
  branch?: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    gstNo?: string;
  } | null;
  member?: {
    id: string;
    status: string;
    joinDate: string;
    emergencyContact?: string;
    subscriptions?: any[];
  };
  trainer?: {
    id: string;
    isActive: boolean;
  } | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  branches: any[];
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(localStorage.getItem('activeBranchId'));
  const [branches, setBranches] = useState<any[]>([]);

  const setActiveBranchId = (id: string | null) => {
    if (id) {
      localStorage.setItem('activeBranchId', id);
    } else {
      localStorage.removeItem('activeBranchId');
    }
    setActiveBranchIdState(id);
  };

  const login = (newToken: string, newUser: UserProfile) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeBranchId');
    setToken(null);
    setUser(null);
    setBranches([]);
    setActiveBranchIdState(null);
  };

  const branchesFetchedRef = React.useRef(false);

  const fetchBranches = async (currentUser: typeof user) => {
    if (!currentUser || !['ADMIN', 'STAFF', 'TRAINER'].includes(currentUser.role)) return;
    try {
      const data = await apiFetch<{ branches: any[] }>('/branches');
      setBranches(data.branches);
      if (currentUser.role !== 'ADMIN') {
        if (currentUser.branchId) {
          setActiveBranchId(currentUser.branchId);
        }
      } else {
        // Auto-select first branch if nothing is stored
        const storedId = localStorage.getItem('activeBranchId');
        if (!storedId && currentUser.branchId) {
          setActiveBranchId(currentUser.branchId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const refreshProfile = async () => {
    try {
      const data = await apiFetch<{ user: UserProfile }>('/auth/me');
      setUser(data.user);
      branchesFetchedRef.current = true;
      await fetchBranches(data.user);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
      logout();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        await refreshProfile();
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  useEffect(() => {
    if (user && !branchesFetchedRef.current) {
      fetchBranches(user);
    }
    branchesFetchedRef.current = false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        activeBranchId,
        setActiveBranchId,
        branches,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
