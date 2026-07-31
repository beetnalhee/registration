import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ApplyPage } from './pages/ApplyPage';
import { CompletePage } from './pages/CompletePage';
import { LandingPage } from './pages/LandingPage';
import { LookupPage } from './pages/LookupPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminParticipantsPage } from './pages/admin/AdminParticipantsPage';
import { RequireAdminSession } from './pages/admin/RequireAdminSession';

export const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/apply/complete" element={<CompletePage />} />
      <Route path="/lookup" element={<LookupPage />} />

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<RequireAdminSession />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/participants" element={<AdminParticipantsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
