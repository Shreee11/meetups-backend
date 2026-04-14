const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

// Index to auto-delete expired documents
verificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Verification = mongoose.model('Verification', verificationSchema);

module.exports = Verification;
