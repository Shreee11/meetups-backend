/**
 * Firebase Admin SDK — Push Notification Utility
 * Set FIREBASE_SERVICE_ACCOUNT env var as a JSON string of your service account key.
 * In development, notifications are logged to console instead of sent.
 */

let admin;
let initialized = false;

const initFirebase = () => {
  if (initialized) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return;

  try {
    admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('⚠️  Firebase Admin init failed:', err.message);
  }
};

/**
 * Send a push notification to a single FCM token.
 * @param {string} fcmToken
 * @param {{ title: string, body: string }} notification
 * @param {Object.<string,string>} [data={}]
 */
const sendPushNotification = async (fcmToken, notification, data = {}) => {
  if (!fcmToken) return null;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT || process.env.NODE_ENV !== 'production') {
    console.log(`📱 [FCM-DEV] → ${notification.title}: ${notification.body}`);
    return { messageId: 'dev-mock' };
  }

  initFirebase();
  if (!initialized) return null;

  // All data values must be strings
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const message = {
    token: fcmToken,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: stringData,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        channelId: 'tender_notifications',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    return await admin.messaging().send(message);
  } catch (err) {
    // Invalid token — caller should remove it from the user record
    if (err.code === 'messaging/invalid-registration-token' ||
        err.code === 'messaging/registration-token-not-registered') {
      return { invalidToken: true };
    }
    console.error('FCM send error:', err.message);
    return null;
  }
};

/**
 * Send a notification and persist it to the Notification collection.
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.fcmToken
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.body
 * @param {string} [params.imageUrl]
 * @param {Object} [params.data]
 */
const sendAndSaveNotification = async ({ userId, fcmToken, type, title, body, imageUrl, data = {} }) => {
  const { Notification } = require('../models');

  // Persist notification in DB
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    body,
    imageUrl,
    data,
  });

  // Send push notification
  if (fcmToken) {
    const result = await sendPushNotification(fcmToken, { title, body }, {
      notificationId: notification._id.toString(),
      type,
      ...data,
    });

    // Clear invalid token
    if (result?.invalidToken) {
      const { User } = require('../models');
      await User.findByIdAndUpdate(userId, { $unset: { fcmToken: '' } });
    }
  }

  return notification;
};

module.exports = { sendPushNotification, sendAndSaveNotification };
