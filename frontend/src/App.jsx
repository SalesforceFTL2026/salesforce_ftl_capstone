import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HelpSeekerDashboard from './pages/HelpSeekerDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import OrganizationDashboard from './pages/OrganizationDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ComingSoon from './pages/ComingSoon';

const App = () => {
  return (
    <Routes>
      {/* Public landing page with the role cards + sign-in */}
      <Route path="/" element={<LandingPage />} />

      {/* Help-seeker dashboard: their requests + a compact request form */}
      <Route path="/requests/new" element={<HelpSeekerDashboard />} />

      {/* Volunteer dashboard: Priority Feed + My Interests */}
      <Route path="/dashboard" element={<VolunteerDashboard />} />

      {/* Organization dashboard: Priority Feed + Active Responses */}
      <Route path="/organization" element={<OrganizationDashboard />} />

      {/* Admin demo dashboard: switch between the three persona views and
          toggle preview-only vs. permanent edits (admin account only). */}
      <Route path="/admin" element={<AdminDashboard />} />

      {/* Organization destination (placeholder for teammates) */}
      <Route path="/feed" element={<ComingSoon title="Volunteer Feed" />} />
    </Routes>
  );
}

export default App;
