const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  swiper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  swiped: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['like', 'nope', 'superlike'],
    required: true,
  },
  matched: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound index for unique swipes
swipeSchema.index({ swiper: 1, swiped: 1 }, { unique: true });
swipeSchema.index({ swiped: 1, action: 1 });
swipeSchema.index({ createdAt: -1 });

const Swipe = mongoose.model('Swipe', swipeSchema);

module.exports = Swipe;
