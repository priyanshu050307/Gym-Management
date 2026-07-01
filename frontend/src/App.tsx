import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ProtectedRoute } from './components/ProtectedRoute.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { Login } from './pages/Login.js';
import { DashboardOverview } from './pages/DashboardOverview.js';
import { MembersList } from './pages/MembersList.js';
import { MemberRegister } from './pages/MemberRegister.js';
import { MemberDetails } from './pages/MemberDetails.js';
import { Plans } from './pages/Plans.js';
import { BillingList } from './pages/BillingList.js';
import { KioskScanner } from './pages/KioskScanner.js';
import { Schedules } from './pages/Schedules.js';
import { MemberPortal } from './pages/MemberPortal.js';
import { Branches } from './pages/Branches.js';
import { TrainerPortal } from './pages/TrainerPortal.js';
import { Equipment } from './pages/Equipment.js';
import { Supplements } from './pages/Supplements.js';

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'MEMBER') {
    return <Navigate to="/portal" replace />;
  }
  if (user?.role === 'TRAINER') {
    return <Navigate to="/trainer-portal" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />

          {/* Secure Administrative & Member Dashboard Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'MEMBER', 'TRAINER']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Redirect root based on user role */}
            <Route index element={<HomeRedirect />} />
            
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

            {/* Member Self-Service Portal Route */}
            <Route path="portal" element={<MemberPortal />} />

            {/* Trainer Self-Service Portal Route */}
            <Route path="trainer-portal" element={<TrainerPortal />} />
          </Route>

          {/* Catch-all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
