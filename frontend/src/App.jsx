import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import HelpSeekerDashboard from './pages/HelpSeekerDashboard';
import ComingSoon from './pages/ComingSoon';

const App = () => {
  return (
    <Routes>
      {/* Public landing page with the role cards + sign-in */}
      <Route path="/" element={<LandingPage />} />

      {/* Help-seeker dashboard: their requests + a compact request form */}
      <Route path="/requests/new" element={<HelpSeekerDashboard />} />

      {/* Volunteer + organization destinations (placeholders for teammates) */}
      <Route path="/feed" element={<ComingSoon title="Volunteer Feed" />} />
      <Route path="/dashboard" element={<ComingSoon title="Organization Dashboard" />} />
    </Routes>
  );
}

export default App;
