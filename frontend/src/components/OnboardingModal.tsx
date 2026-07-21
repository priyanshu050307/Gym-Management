import React, { useState } from 'react';
import { apiFetch } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Sparkles, 
  CheckCircle2, 
  Layers, 
  Users, 
  UserPlus, 
  Rocket, 
  X
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataGenerated?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onDataGenerated }) => {
  const { activeBranchId } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateDemo = async () => {
    try {
      setGenerating(true);
      setError(null);
      const headers: Record<string, string> = {};
      if (activeBranchId) headers['x-branch-id'] = activeBranchId;

      await apiFetch<any>('/demo/seed', {
        method: 'POST',
        headers,
      });

      setSuccessMsg('Sample demo data successfully populated! Plans, members, check-ins, leads, and payroll entries are ready.');
      setTimeout(() => {
        if (onDataGenerated) onDataGenerated();
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Failed to generate demo sample data.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-card max-w-lg w-full p-8 rounded-3xl border border-gym-primary/30 space-y-6 bg-slate-900 text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gym-muted hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 bg-gym-primary/20 text-gym-primary border border-gym-primary/30 rounded-2xl flex items-center justify-center">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white">Welcome to Gymnasium!</h3>
            <p className="text-xs text-gym-muted">Quick onboarding setup for your gym branch.</p>
          </div>
        </div>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">{error}</div>}
        {successMsg && <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-bold">{successMsg}</div>}

        {/* Quick Start Checklist */}
        <div className="space-y-3 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-xs">
          <span className="font-bold text-gym-primary uppercase tracking-wider text-[11px] block">Quick Start Checklist</span>
          <div className="flex items-center gap-2.5 text-slate-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Branch location initialized & active license verified</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <Layers className="h-4 w-4 text-gym-primary shrink-0" />
            <span>Create membership packages & pricing plans</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <Users className="h-4 w-4 text-gym-primary shrink-0" />
            <span>Register gym members & assign subscriptions</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <UserPlus className="h-4 w-4 text-gym-primary shrink-0" />
            <span>Track walk-in leads & staff payroll payouts</span>
          </div>
        </div>

        {/* Instant Demo Seed Box */}
        <div className="p-4 bg-gradient-to-r from-gym-primary/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-gym-primary/20 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gym-primary animate-pulse" />
            <h4 className="font-bold text-sm text-white">Instant Demo Seed (1-Click)</h4>
          </div>
          <p className="text-xs text-gym-muted leading-relaxed">
            Want to test analytics, heatmaps, CRM leads, and payouts immediately without manual entry? Click below to populate realistic dummy data.
          </p>
          <button
            onClick={handleGenerateDemo}
            disabled={generating}
            className="w-full py-3 bg-gym-primary text-black font-extrabold rounded-xl text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gym-primary/20 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating Demo Data...' : 'Populate Sample Demo Data'}
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
          >
            Start Manual Setup
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
