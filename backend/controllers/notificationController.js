import * as notificationModel from '../models/notificationModel.js';

/**
 * Notification Controller
 * Handles the in-app notification bell: list, unread count, and mark-read.
 * Every handler is scoped to req.user.id so a user can only ever see or
 * touch their own notifications.
 */

// GET /api/notifications
// The signed-in user's notifications (newest first) plus the unread count,
// so the bell can render the list and the badge from one call.
export const getMyNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      notificationModel.getNotificationsForUser(req.user.id),
      notificationModel.getUnreadCount(req.user.id),
    ]);

    res.status(200).json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

// GET /api/notifications/unread-count
// Lightweight endpoint for polling the badge without pulling the full list.
export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await notificationModel.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message,
    });
  }
};

// PATCH /api/notifications/:id/read
// Mark a single notification read. 404 if it isn't the user's / doesn't exist.
export const markRead = async (req, res) => {
  try {
    const updated = await notificationModel.markAsRead(req.params.id, req.user.id);
    if (updated === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }
    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message,
    });
  }
};

// PATCH /api/notifications/read-all
// Mark all of the user's unread notifications read (bell "mark all read").
export const markAllRead = async (req, res) => {
  try {
    const count = await notificationModel.markAllAsRead(req.user.id);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      data: { count },
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
      error: error.message,
    });
  }
};
