import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';

// The landing page is the entry point, so it loads eagerly. The dashboards are
// heavier (they pull in the map, Leaflet, county data, charts, etc.) and each
// serves a different role, so we code-split them: a visitor on the landing page
// no longer downloads all four dashboards' code up front. Each becomes its own
// chunk, fetched on first navigation to that route.
const HelpSeekerDashboard = lazy(() => import('./pages/HelpSeekerDashboard'));
const VolunteerDashboard = lazy(() => import('./pages/VolunteerDashboard'));
const OrganizationDashboard = lazy(() => import('./pages/OrganizationDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));

// Simple full-viewport fallback shown while a route chunk downloads.
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#c9d6c2] dark:bg-[#0f1a0f]">
    <p className="text-[#1C2A16] dark:text-white text-lg font-semibold">Loading…</p>
  </div>
);

const App = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}

export default App;
