import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../utils/api.js';
import { Dumbbell, AlertCircle, CheckCircle } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, isMockAuth } from '../config/firebase.js';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';
  const successMessage = location.state?.successMessage;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      let idToken = '';
      if (isMockAuth) {
        // Simulated delay for premium UX
        await new Promise((resolve) => setTimeout(resolve, 1000));
        idToken = 'mock-google-token';
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        idToken = await result.user.getIdToken();
      }

      const data = await apiFetch('/auth/firebase-login', {
        method: 'POST',
        body: { idToken },
      });

      completeLocalAuth(data);
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const completeLocalAuth = (data: any) => {
    let targetPath = from;
    if (from === '/dashboard') {
      if (data.user.role === 'MEMBER') targetPath = '/portal';
      else if (data.user.role === 'TRAINER') targetPath = '/trainer-portal';
    }

    login(data.token, data.user);
    navigate(targetPath, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      completeLocalAuth(data);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gym-darker relative overflow-hidden px-4">
      {/* Background radial gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gym-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gym-secondary/10 blur-[120px]" />

      <div className="w-full max-w-md glass-card p-8 rounded-2xl relative z-10">
        <div className="flex flex-col items-center mb-6">
          <div className="h-16 w-16 rounded-2xl bg-gym-primary/20 flex items-center justify-center mb-4 border border-gym-primary/30">
            <Dumbbell className="h-10 w-10 text-gym-primary" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-wider bg-gradient-premium bg-clip-text text-transparent">
            GYMNASIUM
          </h2>
          <p className="text-gym-muted mt-2 text-sm text-center">
            Sign in to access your dashboard and fitness records
          </p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-3 text-sm">
            <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gym-text/80 mb-2" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@gym.com"
              className="gym-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gym-text/80 mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="gym-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-premium hover:opacity-90 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Auth Providers Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gym-darker px-2 text-gym-muted">Or continue with</span>
          </div>
        </div>

        {/* Social Authentication buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign In with Google
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100/10 text-center text-xs text-gym-muted">
          New gym owner?{' '}
          <Link to="/register-owner" className="text-gym-primary font-semibold hover:underline">
            Register your gym here
          </Link>
        </div>
      </div>
    </div>
  );
};
