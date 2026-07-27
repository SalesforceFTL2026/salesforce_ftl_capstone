import api from './api';
import { setLanguage } from '../i18n';
import { clearPreviewStore } from './previewMode';

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
  // Apply the language saved on the user's profile so their preference follows
  // them to this device. Falls back to English if they never set one.
  if (user?.languagePreference) {
    setLanguage(user.languagePreference);
  }
  return user;
};

// Register a new user, then log them in so we get a token (signup itself
// returns no token). Returns the logged-in user object.
export const signup = async ({ name, email, password, role, location, skills }) => {
  const { data } = await api.post('/api/auth/signup', {
    name,
    email,
    password,
    role,
    location,
    // Only volunteers pick skills; other roles send an empty list, which the
    // backend ignores.
    skills: skills ?? [],
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

// Update the logged-in user's profile. Pass any of { name, location }; only the
// fields provided are changed. Persists the returned user and returns it.
// Throws with a friendly message on failure.
export const updateProfile = async (fields) => {
  const { data } = await api.patch('/api/auth/me', fields);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update your profile.');
  }

  // Merge the updated fields into the stored user so the session stays current.
  const merged = { ...getCurrentUser(), ...data.data };
  setCurrentUser(merged);
  return merged;
};

// Convenience wrapper for the common case of changing just the display name.
export const updateName = (name) => updateProfile({ name });

// Convenience wrapper for changing just the phone number. Pass an empty string
// to clear it (it's optional). The backend validates the format.
export const updatePhone = (phoneNumber) => updateProfile({ phoneNumber });

// Convenience wrapper for changing just the household size. Pass '' or null to
// clear it (it's optional). The backend validates it's a positive whole number.
export const updateHousehold = (householdSize) => updateProfile({ householdSize });

// Upload a new profile picture. Sends the file as multipart/form-data to the
// avatar endpoint, stores the returned signed URL on the session user, and
// returns it so the UI can show the new picture immediately.
export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file); // field name must match multer's .single('avatar')

  const { data } = await api.post('/api/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!data?.success) {
    throw new Error(data?.message || 'Could not upload your photo.');
  }

  // Merge the fresh signed URL into the stored user so the session stays current.
  const merged = { ...getCurrentUser(), avatarUrl: data.avatarUrl };
  setCurrentUser(merged);
  return data.avatarUrl;
};

// Save the user's UI language to their profile AND switch the live UI to it.
// Returns the updated user object.
export const updateLanguage = async (lang) => {
  const updated = await updateProfile({ languagePreference: lang });
  setLanguage(lang);
  return updated;
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

// Clear the stored session so the user is signed out. Also wipe any admin
// preview overlay so simulated (session-only) edits never carry into a later
// login or a real user's view.
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearPreviewStore();
};

// Turn any auth error (axios or thrown Error) into a safe message to show.
export const authErrorMessage = (err, fallback) =>
  err.response?.data?.message || err.message || fallback;
