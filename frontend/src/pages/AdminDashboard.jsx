import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HelpSeekerDashboard from './HelpSeekerDashboard';
import VolunteerDashboard from './VolunteerDashboard';
import OrganizationDashboard from './OrganizationDashboard';
import { getCurrentUser, logout } from '../utils/auth';
import { isPreviewMode, setPreviewMode } from '../utils/previewMode';

// Admin dashboard — a demo tool, reachable by logging in as the seeded admin
// account (admin / admin, see backend/prisma/seedAdmin.js).
//
// It lets a presenter flip between the three persona dashboards from one login
// without signing in and out, and choose whether edits made while demoing are:
//   • Preview only — writes are intercepted client-side (utils/previewMode +
//     utils/api) so the UI reacts but nothing is persisted; great for a live
//     demo you can repeat cleanly.
//   • Permanent — writes go through to the database as normal.
//
// The persona dashboards are rendered as-is (same components real users see),
// running against the admin's own authenticated session. Since requests are
// largely global, the feeds/lists populate; persona-specific data tied to a
// real account (e.g. a volunteer's own interests) may be empty.

const PERSONAS = [
  { id: 'help-seeker', label: 'Help Seeker' },
  { id: 'volunteer', label: 'Volunteer' },
  { id: 'organization', label: 'Organization' },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [currentUser] = useState(getCurrentUser);
  const [persona, setPersona] = useState('help-seeker');
  // Local mirror of the preview flag so the toggle re-renders on change.
  const [preview, setPreview] = useState(isPreviewMode);

  // Only the admin account may view this page. Anyone else is bounced home.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const togglePreview = (on) => {
    setPreviewMode(on);
    setPreview(on);
  };

  const handleSignOut = () => {
    logout();
    navigate('/');
  };

  if (!currentUser || currentUser.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1a2e]">
      {/* Admin control bar — sticky so it stays reachable while scrolling a
          persona dashboard underneath it. */}
      <div className="sticky top-0 z-[1500] bg-[#1C2A16] text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold uppercase tracking-wide bg-white/15 px-3 py-1 rounded-lg">
              Admin
            </span>
            <span className="hidden sm:inline text-sm text-white/70">
              Demo view switcher
            </span>
          </div>

          {/* Persona switcher */}
          <div className="inline-flex gap-1 p-1 rounded-xl bg-white/10">
            {PERSONAS.map((p) => {
              const active = p.id === persona;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  aria-pressed={active}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 ${
                    active ? 'bg-white text-[#1C2A16]' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            {/* Preview vs. Permanent edit mode */}
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-semibold ${preview ? 'text-white' : 'text-white/50'}`}
              >
                Preview
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!preview}
                onClick={() => togglePreview(!preview)}
                title={
                  preview
                    ? 'Preview only: edits are not saved'
                    : 'Permanent: edits are saved to the database'
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 ${
                  preview ? 'bg-white/30' : 'bg-[#c84444]'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    preview ? 'translate-x-0.5' : 'translate-x-[22px]'
                  }`}
                />
              </button>
              <span
                className={`text-sm font-semibold ${!preview ? 'text-white' : 'text-white/50'}`}
              >
                Permanent
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm font-semibold underline hover:no-underline"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mode reminder banner — makes it obvious whether edits will stick. */}
        <div
          className={`text-center text-xs font-semibold py-1 ${
            preview ? 'bg-[#6ba3d3] text-white' : 'bg-[#c84444] text-white'
          }`}
        >
          {preview
            ? 'Preview only — changes you make here are NOT saved to the database.'
            : 'Permanent mode — changes you make here ARE saved to the database.'}
        </div>
      </div>

      {/* The selected persona's real dashboard. Keyed by persona + mode so it
          fully remounts on a switch, resetting local state and re-fetching. */}
      <div key={`${persona}-${preview}`}>
        {persona === 'help-seeker' && <HelpSeekerDashboard />}
        {persona === 'volunteer' && <VolunteerDashboard />}
        {persona === 'organization' && <OrganizationDashboard />}
      </div>
    </div>
  );
};

export default AdminDashboard;
