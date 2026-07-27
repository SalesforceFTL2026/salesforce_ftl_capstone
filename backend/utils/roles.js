// Role helpers.
//
// The seeded demo `admin` account (backend/prisma/seedAdmin.js) powers the
// /admin dashboard, which lets a presenter flip between the help-seeker,
// volunteer, and organization views from one login. To make that demo useful in
// "Permanent" mode — where changes really are saved — admin must be allowed to
// perform the actions each of those roles can. So every role gate treats admin
// as also holding the required role.
//
// This is a real privilege grant, so it is deliberately funnelled through one
// place. It is safe because `admin` is seed-only: there is no self-service way to
// register or promote an account to admin (see authController — signup always
// assigns one of the three normal roles). Records admin creates are still tied
// to the admin's own user id (we never trust a client-supplied identity), so an
// admin-created request is stamped submitterRole 'admin' and admin-created
// resources/tasks live under a single admin-owned organization profile.

// True when the user holds the given role, OR is the admin (who may act as any
// role for the demo). Use this in place of `user.role === 'someRole'` checks.
export const hasRole = (user, role) => user?.role === role || user?.role === 'admin';

export const isAdmin = (user) => user?.role === 'admin';
