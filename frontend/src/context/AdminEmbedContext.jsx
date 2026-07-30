import { createContext, useContext } from 'react';

// True when a persona dashboard is being rendered INSIDE the admin dashboard's
// view switcher (AdminDashboard.jsx) rather than standalone. The admin control
// bar already provides its own "Sign out", so the portal top bar hides its
// duplicate one when this is set (issue #242 — two sign-out buttons on admin).
//
// Defaults to false, so a normally-logged-in user's portal shows its sign-out
// exactly as before.
const AdminEmbedContext = createContext(false);

export const AdminEmbedProvider = AdminEmbedContext.Provider;

export const useIsAdminEmbed = () => useContext(AdminEmbedContext);

export default AdminEmbedContext;
