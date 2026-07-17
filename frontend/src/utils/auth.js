import api from './api';

// All sign-up / sign-in calls and token storage live here so components stay
// thin and there is a single source of truth for how we talk to the auth API.
//
// Backend contract (backend/controllers/authController.js):
//   POST /api/auth/signup -> { success, data: { id, name, email, role } }   (no token)
//   POST /api/auth/login  -> { success, data: { token, user: {...} } }

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

// Save the login token + user so refreshing the page keeps you signed in.
const persistSession = ({ token, user }) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Log in an existing user. Returns the user object on success.
// Throws an Error with a user-friendly message on failure.
export const login = async ({ email, password }) => {
  const { data } = await api.post('/api/auth/login', { email, password });

  if (!data?.success) {
    throw new Error(data?.message || 'Sign in failed. Please try again.');
  }

  const { token, user } = data.data;
  persistSession({ token, user });
  return user;
};

// Register a new user, then log them in so we get a token (signup itself
// returns no token). Returns the logged-in user object.
export const signup = async ({ name, email, password, role, location }) => {
  const { data } = await api.post('/api/auth/signup', {
    name,
    email,
    password,
    role,
    location,
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Sign up failed. Please try again.');
  }

  // Signup doesn't return a token, so log in immediately with the same creds.
  return login({ email, password });
};

// Overwrite the stored user (keeping the existing token), so UI that reads
// getCurrentUser() picks up profile changes after a page refresh too.
export const setCurrentUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Update the logged-in user's profile (currently just the display name).
// Persists the returned user and returns it. Throws with a friendly message.
export const updateName = async (name) => {
  const { data } = await api.patch('/api/auth/me', { name });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update your name.');
  }

  // Merge the updated fields into the stored user so the session stays current.
  const merged = { ...getCurrentUser(), ...data.data };
  setCurrentUser(merged);
  return merged;
};

// Read the signed-in user saved at login, or null if nobody is signed in.
// Used to restore the session when the app first loads.
export const getCurrentUser = () => {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    // Corrupted value — treat as signed out.
    return null;
  }
};

// Clear the stored session so the user is signed out.
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Turn any auth error (axios or thrown Error) into a safe message to show.
export const authErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;
