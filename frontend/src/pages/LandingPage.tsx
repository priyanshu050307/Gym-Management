import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../utils/api.js';
import { GymBotWidget } from '../components/GymBotWidget.js';
import { 
  Dumbbell, 
  Shield, 
  Users, 
  TrendingUp, 
  Mail, 
  Phone, 
  MapPin, 
  ArrowRight,
  CheckCircle,
  Star,
  Check,
  Zap
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // SaaS states on public landing page
  const [saasSub, setSaasSub] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // If user is logged in, check their SaaS tenant state
    if (user && user.role === 'ADMIN') {
      const checkSaaS = async () => {
        try {
          const data = await apiFetch<{ subscription: any }>('/saas/status');
          setSaasSub(data.subscription);
        } catch (err) {
          console.error('Failed to load SaaS status on landing page:', err);
        }
      };
      checkSaaS();
    }
  }, [user]);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setContactName('');
    setContactEmail('');
    setContactMessage('');
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleLoginClick = () => {
    if (user) {
      if (user.role === 'MEMBER') navigate('/portal');
      else if (user.role === 'TRAINER') navigate('/trainer-portal');
      else navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (!user) {
      navigate('/register-owner');
      return;
    }

    if (user.role !== 'ADMIN') {
      setError('Only the gym owner account can purchase or change tenant subscriptions.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      setSuccess(null);

      let finalPrice = planName === 'Starter' ? 1499 : planName === 'Professional' ? 3499 : 7999;
      if (billingCycle === 'YEARLY') {
        finalPrice = finalPrice * 10;
      }
      if (couponApplied) {
        finalPrice = Math.round(finalPrice * 0.7); // 30% off
      }

      await apiFetch<any>('/saas/subscribe', {
        method: 'POST',
        body: {
          planName,
          billingCycle,
          cardBrand: 'Visa',
          cardLast4: '4242',
        },
      });

      setSuccess(`Thank you for subscribing to GymOS ${planName}! Activating access...`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to complete subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.toUpperCase() === 'FITJULY30') {
      setCouponApplied(true);
      setSuccess('Coupon code FITJULY30 (30% Discount) applied successfully!');
    } else {
      setError('Invalid coupon code.');
    }
  };


  const benefits = [
    {
      icon: Shield,
      title: 'Branch Isolation & Control',
      desc: 'Secure multi-tenant environment ensuring branch staff access only their branch data, while admins oversee globally.'
    },
    {
      icon: Users,
      title: 'Personal Training Roster',
      desc: 'Dedicated portal for trainers to monitor client workouts, diet macros, check-ins, and progressive overload histories.'
    },
    {
      icon: TrendingUp,
      title: 'Supplement Retail POS',
      desc: 'Process product transactions at the front desk, manage inventory levels, and log sales to members automatically.'
    },
    {
      icon: CheckCircle,
      title: 'Self-Service Member App',
      desc: 'Empower members to view active subscriptions, book group fitness classes, log weights, and rate their trainers.'
    }
  ];

  const reviews = [
    {
      name: 'Rohan Sharma',
      role: 'Gym Member',
      rating: 5,
      comment: 'The member portal is fantastic! I can see my workout cards and macro meals directly on my phone. Highly recommend.'
    },
    {
      name: 'Priya Patel',
      role: 'Head Trainer',
      rating: 5,
      comment: 'Managing 15+ PT clients is now seamless. Logging workout progress and diets takes seconds instead of hours of paperwork.'
    },
    {
      name: 'Amit Verma',
      role: 'Branch Manager',
      rating: 5,
      comment: 'The Check-In Kiosk and Billing alerts saved our reception team massive hours. Multi-branch stats are clean and accurate.'
    }
  ];

  return (
    <div className="min-h-screen bg-gym-darker text-gym-text selection:bg-gym-primary selection:text-black">
      
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 glass-nav border-b border-slate-100/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-gym-primary" />
            <span className="text-xl font-bold tracking-wider bg-gradient-premium bg-clip-text text-transparent">
              GYMNASIUM
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gym-muted">
            <a href="#about" className="hover:text-gym-primary transition-colors">About</a>
            <a href="#benefits" className="hover:text-gym-primary transition-colors">Benefits</a>
            <a href="#pricing" className="hover:text-gym-primary transition-colors">Pricing & Plans</a>
            <a href="#reviews" className="hover:text-gym-primary transition-colors">Reviews</a>
            <a href="#contact" className="hover:text-gym-primary transition-colors">Contact</a>
          </nav>

          <button
            onClick={handleLoginClick}
            className="flex items-center gap-2 px-5 py-2.5 bg-gym-primary hover:bg-gym-primary-hover text-black font-semibold rounded-xl transition-all duration-200 shadow-md shadow-gym-primary/10"
          >
            {user ? 'Go to App' : 'Login'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Expiry Alerts & Success Banner */}
      {((saasSub && (saasSub.status === 'TRIAL_EXPIRED' || saasSub.status === 'SUBSCRIBED_EXPIRED')) || location.state?.fromExpired) && (
        <div className="w-full bg-red-600/90 text-white text-center py-3.5 px-6 font-bold flex items-center justify-center gap-2 animate-pulse text-sm">
          <span>🚨 Trial or Subscription Ended. Please choose a paid plan below to instantly reactivate your GymOS cloud tenant.</span>
        </div>
      )}

      {error && (
        <div className="max-w-7xl mx-auto mt-6 px-6">
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto mt-6 px-6">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {success}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gym-primary/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-5xl mx-auto px-6 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gym-primary/15 border border-gym-primary/20 text-gym-primary rounded-full text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Next-Generation Gym Management
          </div>
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none bg-gradient-premium bg-clip-text text-transparent">
            Powering Premium Fitness Operations
          </h1>
          
          <p className="text-lg sm:text-xl text-gym-muted max-w-3xl mx-auto">
            A unified solution to manage branch metrics, classes, personal training schedules, automated subscription billing, and supplement inventory POS in one cohesive platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleLoginClick}
              className="w-full sm:w-auto px-8 py-4 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl shadow-lg shadow-gym-primary/20 transition-all flex items-center justify-center gap-2"
            >
              Get Started Now
              <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href="#about"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-gym-text border border-slate-800 font-bold rounded-xl transition-all flex items-center justify-center"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 border-t border-slate-100/10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Unified Multi-Branch Ecosystem</h2>
            <p className="text-gym-muted leading-relaxed">
              Designed specifically for fitness entrepreneurs and managers, this application bridges the gap between daily front-desk operations and long-term business analytics.
            </p>
            <p className="text-gym-muted leading-relaxed">
              From the instant a member scans their attendance at the front lobby Kiosk to the moment a trainer updates their caloric macros, all touchpoints synchronize in a secure cloud ledger.
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-gym-primary" />
                <span className="font-medium">100% Paperless</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-gym-primary" />
                <span className="font-medium">Real-Time Sync</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-gym-primary" />
                <span className="font-medium">Role-Based Portals</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-gym-primary" />
                <span className="font-medium">Automated CRON Alerts</span>
              </div>
            </div>
          </div>

          <div className="glass-card border border-slate-100/10 p-8 rounded-3xl relative overflow-hidden space-y-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gym-primary/10 rounded-bl-full -z-10" />
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gym-primary/20 rounded-lg flex items-center justify-center border border-gym-primary/30">
                <Dumbbell className="h-5 w-5 text-gym-primary" />
              </div>
              <span className="text-lg font-bold">Key Modules Included</span>
            </div>
            
            <ul className="space-y-3.5 text-sm text-gym-muted">
              <li className="flex justify-between border-b border-slate-100/10 pb-2">
                <span>Member Onboarding & Subscriptions</span>
                <span className="text-gym-primary font-mono">Active</span>
              </li>
              <li className="flex justify-between border-b border-slate-100/10 pb-2">
                <span>Diet & Workout Plan Editors</span>
                <span className="text-gym-primary font-mono">Active</span>
              </li>
              <li className="flex justify-between border-b border-slate-100/10 pb-2">
                <span>Classes Scheduling & Slot Limits</span>
                <span className="text-gym-primary font-mono">Active</span>
              </li>
              <li className="flex justify-between border-b border-slate-100/10 pb-2">
                <span>Supplements POS Checkout Store</span>
                <span className="text-gym-primary font-mono">Active</span>
              </li>
              <li className="flex justify-between">
                <span>Billing Invoices & Refund Ledgers</span>
                <span className="text-gym-primary font-mono">Active</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-slate-950/40 border-t border-slate-100/10">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Engineered for Results</h2>
            <p className="text-gym-muted max-w-xl mx-auto">
              Discover how our customized modules speed up administration and optimize member retention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div key={idx} className="glass-card border border-slate-100/10 p-6 rounded-2xl space-y-4 hover:border-gym-primary/30 transition-all duration-300">
                  <div className="h-12 w-12 bg-gym-primary/10 rounded-xl flex items-center justify-center text-gym-primary border border-gym-primary/20">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gym-text">{b.title}</h3>
                  <p className="text-sm text-gym-muted leading-relaxed">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section id="reviews" className="py-20 border-t border-slate-100/10">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Loved by Gym Owners & Members</h2>
            <p className="text-gym-muted max-w-xl mx-auto">
              Read real-life testimonials from branches already powered by our management platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((r, idx) => (
              <div key={idx} className="glass-card border border-slate-100/10 p-6 rounded-2xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[...Array(r.rating)].map((_, i) => (
                      <Star key={i} className="h-4.5 w-4.5 fill-gym-primary text-gym-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-gym-muted italic leading-relaxed">
                    "{r.comment}"
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100/10">
                  <div className="h-9 w-9 bg-gym-primary/10 rounded-full flex items-center justify-center font-bold text-gym-primary">
                    {r.name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gym-text">{r.name}</h4>
                    <span className="text-xs text-gym-muted">{r.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SaaS Subscription Plans Section */}
      <section id="pricing" className="py-20 border-t border-slate-100/10 bg-slate-900/10">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl font-extrabold tracking-tight">Flexible SaaS Subscription Plans</h2>
            <p className="text-gym-muted text-sm">
              Activate your cloud instance immediately. Save up to 20% by paying annually. Free trial users can purchase paid plans to restore instant write actions.
            </p>

            {/* Toggle Billing Interval */}
            <div className="inline-flex items-center gap-3 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800 mx-auto mt-4">
              <button
                onClick={() => setBillingCycle('MONTHLY')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === 'MONTHLY' ? 'bg-gym-primary text-black' : 'text-gym-muted hover:text-gym-text'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('YEARLY')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  billingCycle === 'YEARLY' ? 'bg-gym-primary text-black' : 'text-gym-muted hover:text-gym-text'
                }`}
              >
                Yearly (2 Months Free)
              </button>
            </div>
          </div>

          {/* Plan Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Starter',
                price: billingCycle === 'YEARLY' ? '₹14,990' : '₹1,499',
                features: ['1 Branch Location', 'Up to 200 Gym Members', 'Check-In Kiosk Scanner', 'Basic Revenue Reports', 'SMS Alerts & Notifications'],
                badge: 'Solopreneurs'
              },
              {
                name: 'Professional',
                price: billingCycle === 'YEARLY' ? '₹34,990' : '₹3,499',
                features: ['3 Branch Locations', 'Unlimited Members', 'QR Kiosk + Self-Service Portal', 'Class Schedules & Booking', 'Supplement Inventory POS', 'Multi-staff Access Control'],
                badge: 'Popular choice',
                popular: true
              },
              {
                name: 'Enterprise',
                price: billingCycle === 'YEARLY' ? '₹79,990' : '₹7,999',
                features: ['Unlimited Locations', 'Unlimited Members', 'Dedicated Account Manager', 'Custom API access', 'White-labeled Gym Portal', 'All Platform Features Unlocked'],
                badge: 'Large chains'
              }
            ].map((opt) => (
              <div
                key={opt.name}
                className={`glass-card rounded-3xl p-8 border relative flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5 ${
                  opt.popular 
                    ? 'border-gym-primary/40 shadow-xl shadow-gym-primary/5 bg-slate-900/40' 
                    : 'border-slate-100/10 hover:border-gym-primary/20'
                }`}
              >
                {opt.popular && (
                  <span className="absolute -top-3.5 left-6 px-3.5 py-1 bg-gym-primary text-black text-[10px] font-extrabold uppercase rounded-full tracking-wider shadow">
                    Most Popular
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <span className="text-[10px] font-bold text-gym-muted uppercase tracking-wider">{opt.badge}</span>
                    <h4 className="text-2xl font-bold text-gym-text mt-1">{opt.name}</h4>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gym-primary">{opt.price}</span>
                    <span className="text-xs text-gym-muted">/{billingCycle === 'YEARLY' ? 'yr' : 'mo'}</span>
                  </div>

                  <ul className="space-y-3.5 text-xs text-gym-muted border-t border-slate-100/10 pt-5">
                    {opt.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className="h-4.5 w-4.5 text-gym-primary shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  <button
                    onClick={() => handleSubscribe(opt.name)}
                    disabled={actionLoading}
                    className={`w-full py-4 rounded-xl text-xs font-bold transition-all shadow-md ${
                      opt.popular
                        ? 'bg-gym-primary hover:bg-gym-primary-hover text-black shadow-gym-primary/10'
                        : 'bg-slate-900 hover:bg-slate-800 text-gym-text border border-slate-800'
                    }`}
                  >
                    {!user 
                      ? 'Sign Up & Start Trial' 
                      : (saasSub?.planName === opt.name && saasSub?.status.includes('ACTIVE') 
                        ? 'Your Active Plan' 
                        : `Subscribe to ${opt.name}`)}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Coupon Code Section */}
          {!couponApplied && (
            <div className="glass-card p-6 rounded-2xl border border-slate-100/10 max-w-md mx-auto space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-gym-primary" /> Apply Promo Code / Coupon
              </h4>
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. FITJULY30"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="gym-input text-xs"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl text-xs whitespace-nowrap"
                >
                  Apply Code
                </button>
              </form>
              <span className="text-[10px] text-gym-muted block">Use coupon code <strong className="text-gym-primary">FITJULY30</strong> for 30% discount.</span>
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-slate-950/40 border-t border-slate-100/10">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Get in Touch</h2>
            <p className="text-gym-muted leading-relaxed">
              Have questions about integrating your branches, Supabase schemas, or configuring stripe custom billing? Send us a message and our support team will reach out.
            </p>

            <div className="space-y-4 text-sm text-gym-muted">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-gym-primary" />
                <span>support@gymnasium.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gym-primary" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-gym-primary" />
                <span>Connaught Place, New Delhi, India</span>
              </div>
            </div>
          </div>

          <div className="glass-card border border-slate-100/10 p-8 rounded-3xl">
            {submitted ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
                <CheckCircle className="h-16 w-16 text-gym-primary" />
                <h3 className="text-xl font-bold text-gym-text">Message Sent Successfully!</h3>
                <p className="text-sm text-gym-muted">We will respond to your query within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gym-muted mb-1.5">Name</label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="John Doe"
                    className="gym-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gym-muted mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="gym-input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gym-muted mb-1.5">Message</label>
                  <textarea
                    required
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="How can we help your fitness center?"
                    rows={4}
                    className="gym-input text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-gym-primary hover:bg-gym-primary-hover text-black font-bold rounded-xl transition-all shadow-lg shadow-gym-primary/20"
                >
                  Send Inquiry
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100/10 py-8 bg-gym-darker">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gym-muted">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-gym-primary" />
            <span>© {new Date().getFullYear()} Gymnasium ERP. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#about" className="hover:text-gym-primary transition-colors">Privacy Policy</a>
            <a href="#about" className="hover:text-gym-primary transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
      <GymBotWidget />
    </div>
  );
};

// Simple Sparkles icon helper component
const Sparkles = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5z" />
    <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
  </svg>
);
