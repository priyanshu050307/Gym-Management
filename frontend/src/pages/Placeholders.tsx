import React from 'react';
import { CreditCard, QrCode, Calendar, Sparkles } from 'lucide-react';

export const BillingPlaceholder: React.FC = () => {
  return (
    <div className="glass-card p-12 rounded-2xl border border-slate-100 flex flex-col items-center text-center max-w-lg mx-auto mt-12 space-y-6">
      <div className="h-16 w-16 rounded-2xl bg-gym-primary/20 flex items-center justify-center border border-gym-primary/30 text-gym-primary">
        <CreditCard className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Billing & Invoicing Engine</h2>
        <p className="text-gym-muted text-sm">
          Phase 3 Development: Auto-generated PDF invoices, manual cashier checkouts, and sandbox Stripe payment portal integration.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-full text-xs font-semibold">
        <Sparkles className="h-4 w-4" />
        Up Next
      </div>
    </div>
  );
};

export const KioskPlaceholder: React.FC = () => {
  return (
    <div className="glass-card p-12 rounded-2xl border border-slate-100 flex flex-col items-center text-center max-w-lg mx-auto mt-12 space-y-6">
      <div className="h-16 w-16 rounded-2xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30 text-gym-secondary">
        <QrCode className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">QR Attendance Check-In Kiosk</h2>
        <p className="text-gym-muted text-sm">
          Phase 4 Development: Front desk dedicated check-in monitor, QR card generation for members, and webcam QR reader integrations.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-full text-xs font-semibold">
        <Sparkles className="h-4 w-4" />
        Phase 4
      </div>
    </div>
  );
};

export const SchedulesPlaceholder: React.FC = () => {
  return (
    <div className="glass-card p-12 rounded-2xl border border-slate-100 flex flex-col items-center text-center max-w-lg mx-auto mt-12 space-y-6">
      <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
        <Calendar className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Class Scheduling & Bookings</h2>
        <p className="text-gym-muted text-sm">
          Phase 5 Development: Class roster builders (Yoga, Zumba, CrossFit), trainer shift management, and booking calendars.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-gym-primary/10 text-gym-primary border border-gym-primary/20 rounded-full text-xs font-semibold">
        <Sparkles className="h-4 w-4" />
        Phase 5
      </div>
    </div>
  );
};
