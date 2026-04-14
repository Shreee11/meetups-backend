const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  match: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'gif', 'audio'],
    default: 'text',
  },
  mediaUrl: String,
  read: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  liked: {
    type: Boolean,
    default: false,
  },
  likedAt: Date,
  deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: Date,
}, {
  timestamps: true,
});

// Indexes
messageSchema.index({ match: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1, read: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
