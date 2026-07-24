// Maps a user's role to the path they should land on after logging in.
//
// Role is set during role selection / signup and comes back from the server
// on login. We never let the user pick their role at login, so this map is the
// single source of truth for "where does each role go".
//
// @param {string} role - the role string returned by the API (e.g. 'volunteer')
// @returns {string} the path to navigate to; falls back to '/' for unknown roles
// Each persona has its own dashboard route/page, built separately.
const ROLE_PATHS = {
  'help-seeker': '/requests/new',
  'volunteer': '/dashboard',
  'organization': '/organization',
  // The demo admin lands on the admin dashboard, where it can switch between
  // the three persona views (see pages/AdminDashboard.jsx).
  'admin': '/admin',
};

export const pathForRole = (role) => ROLE_PATHS[role] || '/';
