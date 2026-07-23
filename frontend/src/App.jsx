import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HelpSeekerDashboard from './pages/HelpSeekerDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import OrganizationDashboard from './pages/OrganizationDashboard';
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

      {/* Organization destination (placeholder for teammates) */}
      <Route path="/feed" element={<ComingSoon title="Volunteer Feed" />} />
    </Routes>
  );
}

export default App;
