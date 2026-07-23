import api from './api';

// Client helpers for the in-app notification bell. All requests carry the
// login token automatically via the shared axios `api` instance.

// Fetch the signed-in user's notifications + unread count.
// Returns { notifications: [...], unreadCount: number }.
export const getNotifications = async () => {
  const { data } = await api.get('/api/notifications');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load notifications.');
  }

  return data.data;
};

// Fetch just the unread count (cheap — used for background polling).
// Returns a number.
export const getUnreadCount = async () => {
  const { data } = await api.get('/api/notifications/unread-count');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not load unread count.');
  }

  return data.data.unreadCount;
};

// Mark a single notification read.
export const markNotificationRead = async (id) => {
  const { data } = await api.patch(`/api/notifications/${id}/read`);

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update notification.');
  }

  return true;
};

// Mark all of the user's notifications read.
export const markAllNotificationsRead = async () => {
  const { data } = await api.patch('/api/notifications/read-all');

  if (!data?.success) {
    throw new Error(data?.message || 'Could not update notifications.');
  }

  return true;
};
