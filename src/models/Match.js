const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  matchedAt: {
    type: Date,
    default: Date.now,
  },
  isSuperLike: {
    type: Boolean,
    default: false,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  lastMessageAt: {
    type: Date,
  },
  unmatched: {
    type: Boolean,
    default: false,
  },
  unmatchedAt: Date,
  unmatchedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
matchSchema.index({ users: 1 });
matchSchema.index({ matchedAt: -1 });
matchSchema.index({ lastMessageAt: -1 });

// Validate exactly 2 users
matchSchema.pre('save', function(next) {
  if (this.users.length !== 2) {
    next(new Error('Match must have exactly 2 users'));
  }
  next();
});

// Static method to find match between two users
matchSchema.statics.findMatch = function(userId1, userId2) {
  return this.findOne({
    users: { $all: [userId1, userId2] },
    unmatched: false,
  });
};

// Method to get the other user in the match
matchSchema.methods.getOtherUser = function(userId) {
  return this.users.find(u => u.toString() !== userId.toString());
};

const Match = mongoose.model('Match', matchSchema);

module.exports = Match;
