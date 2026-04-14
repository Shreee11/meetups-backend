const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reported: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  reason: {
    type: String,
    enum: ['spam', 'inappropriate_content', 'harassment', 'fake_profile', 'underage', 'hate_speech', 'violence', 'other'],
    required: true,
  },
  description: {
    type: String,
    maxlength: 500,
    default: '',
  },
  matchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match',
  },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
  },
  adminNotes: {
    type: String,
    maxlength: 1000,
  },
}, { timestamps: true });

// Prevent duplicate reports from same user
reportSchema.index({ reporter: 1, reported: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
