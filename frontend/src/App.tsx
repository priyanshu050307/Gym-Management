import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { DashboardLayout } from './components/DashboardLayout.js';

// Lazy load page components to improve initial loading speed
const Login = lazy(() => import('./pages/Login.js').then(m => ({ default: m.Login })));
const LandingPage = lazy(() => import('./pages/LandingPage.js').then(m => ({ default: m.LandingPage })));
const DashboardOverview = lazy(() => import('./pages/DashboardOverview.js').then(m => ({ default: m.DashboardOverview })));
const MembersList = lazy(() => import('./pages/MembersList.js').then(m => ({ default: m.MembersList })));
const MemberRegister = lazy(() => import('./pages/MemberRegister.js').then(m => ({ default: m.MemberRegister })));
const MemberDetails = lazy(() => import('./pages/MemberDetails.js').then(m => ({ default: m.MemberDetails })));
const Plans = lazy(() => import('./pages/Plans.js').then(m => ({ default: m.Plans })));
const BillingList = lazy(() => import('./pages/BillingList.js').then(m => ({ default: m.BillingList })));
const KioskScanner = lazy(() => import('./pages/KioskScanner.js').then(m => ({ default: m.KioskScanner })));
const Schedules = lazy(() => import('./pages/Schedules.js').then(m => ({ default: m.Schedules })));
const MemberPortal = lazy(() => import('./pages/MemberPortal.js').then(m => ({ default: m.MemberPortal })));
const Branches = lazy(() => import('./pages/Branches.js').then(m => ({ default: m.Branches })));
const TrainerPortal = lazy(() => import('./pages/TrainerPortal.js').then(m => ({ default: m.TrainerPortal })));
const Equipment = lazy(() => import('./pages/Equipment.js').then(m => ({ default: m.Equipment })));
const Supplements = lazy(() => import('./pages/Supplements.js').then(m => ({ default: m.Supplements })));
const SaaSBilling = lazy(() => import('./pages/SaaSBilling.js').then(m => ({ default: m.SaaSBilling })));
const RegisterOwner = lazy(() => import('./pages/RegisterOwner.js').then(m => ({ default: m.RegisterOwner })));
const Profile = lazy(() => import('./pages/Profile.js').then(m => ({ default: m.Profile })));
const GymBot = lazy(() => import('./pages/GymBot.js').then(m => ({ default: m.GymBot })));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center bg-gym-darker">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gym-primary border-t-transparent"></div>
          </div>
        }>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register-owner" element={<RegisterOwner />} />

            {/* Secure Administrative & Member Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'MEMBER', 'TRAINER']}>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Administrative Routes */}
              <Route path="dashboard" element={<DashboardOverview />} />
              <Route path="members" element={<MembersList />} />
              <Route path="members/register" element={<MemberRegister />} />
              <Route path="members/:id" element={<MemberDetails />} />
              <Route path="plans" element={<Plans />} />
              <Route path="billing" element={<BillingList />} />
              <Route path="kiosk" element={<KioskScanner />} />
              <Route path="schedules" element={<Schedules />} />
              <Route path="branches" element={<Branches />} />
              <Route path="equipment" element={<Equipment />} />
              <Route path="supplements" element={<Supplements />} />
              <Route path="subscription" element={<SaaSBilling />} />
              <Route path="profile" element={<Profile />} />
              <Route path="gymbot" element={<GymBot />} />

              {/* Member Self-Service Portal Route */}
              <Route path="portal" element={<MemberPortal />} />

              {/* Trainer Self-Service Portal Route */}
              <Route path="trainer-portal" element={<TrainerPortal />} />
            </Route>

            {/* Catch-all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
