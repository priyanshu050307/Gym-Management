import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api.js';
import { Dumbbell, AlertCircle, Sparkles } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider, isMockAuth } from '../config/firebase.js';
import { useAuth } from '../context/AuthContext.js';

export const RegisterOwner: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

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

      login(data.token, data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Google registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: {
          email,
          password,
          firstName,
          lastName,
          role: 'ADMIN' // Always registering as ADMIN for gym owner registration
        },
      });

      // Redirect to login with success state
      navigate('/login', {
        state: {
          successMessage: 'Account created successfully! Log in to begin your 30-day free trial.'
        }
      });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gym-darker relative overflow-hidden px-4 py-12">
      {/* Background radial gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gym-primary/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gym-secondary/10 blur-[120px]" />

      <div className="w-full max-w-lg glass-card p-8 sm:p-10 rounded-3xl relative z-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gym-primary/20 flex items-center justify-center mb-4 border border-gym-primary/30">
            <Dumbbell className="h-10 w-10 text-gym-primary" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-wider bg-gradient-premium bg-clip-text text-transparent">
            GYMNASIUM ERP
          </h2>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-gym-primary/15 border border-gym-primary/20 text-gym-primary rounded-full text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> 30-Day Free Trial Included
          </div>
          <p className="text-gym-muted mt-3 text-sm">
            Create your owner account to initiate your fully-featured cloud tenant.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3 text-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Email Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-2">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="gym-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-2">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="gym-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gym-muted uppercase mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@mygym.com"
              className="gym-input text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="gym-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gym-muted uppercase mb-2">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="gym-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 bg-gradient-premium hover:opacity-90 text-white font-bold rounded-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Create Account & Start Trial'}
          </button>
        </form>

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gym-darker px-2 text-gym-muted">Or register with</span>
          </div>
        </div>

        {/* Social Authentication buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl border border-slate-800 flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-xs"
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
            Sign Up with Google
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100/10 text-center text-xs text-gym-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-gym-primary font-semibold hover:underline">
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
