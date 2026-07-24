import prisma from '../services/database/prisma.js';

/**
 * Notification Model
 * Thin Prisma helpers for the in-app Notification table. Kept deliberately
 * simple (mirrors requestModel.js) — business rules live in the controller.
 */

// Create a single notification row for a user.
// `data` should include at least { userId, type, title, message }.
// Optional: actionUrl, relatedRequestId, relatedUserId.
export const createNotification = async (data) => {
  return await prisma.notification.create({ data });
};

// Get a user's notifications, newest first. Caps the list so the bell
// dropdown never has to render an unbounded history.
export const getNotificationsForUser = async (userId, limit = 30) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

// How many unread notifications a user has — powers the bell's red badge.
export const getUnreadCount = async (userId) => {
  return await prisma.notification.count({
    where: { userId, read: false },
  });
};

// Mark one notification read, but only if it belongs to this user.
// Returns the number of rows updated (0 means it wasn't theirs / didn't exist).
export const markAsRead = async (id, userId) => {
  const result = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return result.count;
};

// Mark every one of a user's unread notifications as read.
export const markAllAsRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return result.count;
};
