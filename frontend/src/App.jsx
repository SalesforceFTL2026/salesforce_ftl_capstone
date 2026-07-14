import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import VolunteerDashboard from './pages/VolunteerDashboard';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* Volunteer dashboard. Help-seeker and organization dashboards are
            separate routes/pages built in their own issues. */}
        <Route path="/dashboard" element={<VolunteerDashboard />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
