const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'new_match',
      'new_message',
      'super_like',
      'profile_like',
      'message_liked',
      'boost_started',
      'subscription_activated',
      'subscription_expiring',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  body: {
    type: String,
    maxlength: 500,
  },
  imageUrl: String,
  // Payload to navigate/act on from the notification
  data: {
    type: Map,
    of: String,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: Date,
}, { timestamps: true });

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

// TTL: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
