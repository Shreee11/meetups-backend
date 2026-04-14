const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const photoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  order: { type: Number, default: 0 },
  isMain: { type: Boolean, default: false },
}, { _id: true });

const locationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], default: [0, 0] }, // [longitude, latitude]
  city: String,
  country: String,
}, { _id: false });

const preferencesSchema = new mongoose.Schema({
  ageMin: { type: Number, default: 18, min: 18, max: 100 },
  ageMax: { type: Number, default: 50, min: 18, max: 100 },
  distanceMax: { type: Number, default: 50, min: 1, max: 500 },
  gender: { type: String, enum: ['men', 'women', 'everyone'], default: 'everyone' },
  global: { type: Boolean, default: false },
}, { _id: false });

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  password: {
    type: String,
    minlength: 8,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  firstName: {
    type: String,
    trim: true,
    minlength: 2,
    maxlength: 50,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  birthday: {
    type: Date,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  bio: {
    type: String,
    maxlength: 500,
    default: '',
  },
  photos: [photoSchema],
  location: locationSchema,
  preferences: {
    type: preferencesSchema,
    default: () => ({}),
  },
  jobTitle: {
    type: String,
    maxlength: 100,
  },
  company: {
    type: String,
    maxlength: 100,
  },
  school: {
    type: String,
    maxlength: 100,
  },
  interests: [{
    type: String,
    trim: true,
  }],
  verified: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
  showMe: {
    type: Boolean,
    default: true,
  },
  lastActive: {
    type: Date,
    default: Date.now,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  
  // Subscription
  subscription: {
    type: { type: String, enum: ['free', 'plus', 'gold', 'platinum'], default: 'free' },
    startDate: Date,
    endDate: Date,
  },
  
  // Daily limits
  dailySwipes: {
    count: { type: Number, default: 0 },
    resetDate: { type: Date, default: Date.now },
  },
  dailySuperLikes: {
    count: { type: Number, default: 0 },
    resetDate: { type: Date, default: Date.now },
  },
  
  // Boost
  boost: {
    active: { type: Boolean, default: false },
    expiresAt: Date,
  },
  
  // Block list
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Elo-based matchability score (1000–3000, default 1400)
  eloScore: {
    type: Number,
    default: 1400,
    min: 100,
    max: 5000,
  },

  // Total number of reports received (auto-incremented)
  reportCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Profile prompts (Hinge-style Q&A)
  prompts: [{
    question: { type: String, maxlength: 200 },
    answer: { type: String, maxlength: 300 },
  }],
  
  // Relationship goal
  relationshipGoal: {
    type: String,
    enum: ['long_term', 'casual', 'friendship', 'unsure', ''],
    default: '',
  },
  
  // Lifestyle attributes
  lifestyle: {
    drinking: { type: String, enum: ['never', 'socially', 'often', ''], default: '' },
    smoking: { type: String, enum: ['never', 'socially', 'yes', ''], default: '' },
    exercise: { type: String, enum: ['never', 'sometimes', 'often', 'daily', ''], default: '' },
    diet: { type: String, enum: ['omnivore', 'vegetarian', 'vegan', 'halal', 'kosher', 'other', ''], default: '' },
    children: { type: String, enum: ['have_and_want_more', 'have_and_dont_want', 'want', 'dont_want', 'open', ''], default: '' },
    education: { type: String, enum: ['high_school', 'some_college', 'college', 'postgrad', 'trade', ''], default: '' },
    zodiac: { type: String, enum: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces', ''], default: '' },
  },

  // Height in cm
  height: {
    type: Number,
    min: 100,
    max: 250,
  },

  // Pronouns
  pronouns: {
    type: String,
    enum: ['he/him', 'she/her', 'they/them', 'he/they', 'she/they', ''],
    default: '',
  },

  // Account
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  refreshToken: String,

  // Email verification
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date,

  // Soft delete
  deletedAt: Date,

  // Push notifications
  fcmToken: String,
  notificationSettings: {
    newMatches: { type: Boolean, default: true },
    messages: { type: Boolean, default: true },
    messageLikes: { type: Boolean, default: true },
    superLikes: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ location: '2dsphere' });
// phone index is auto-created by unique:true on the field — no duplicate needed
userSchema.index({ 'subscription.type': 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ gender: 1 });
userSchema.index({ birthday: 1 });
userSchema.index({ eloScore: -1 });
userSchema.index({ 'boost.active': 1, 'boost.expiresAt': 1 });

// Virtual for profile completeness
userSchema.virtual('isProfileComplete').get(function() {
  return !!(this.firstName && this.birthday && this.gender && this.photos && this.photos.length >= 1);
});

// Virtual for profile completion percentage
userSchema.virtual('profileCompletionPercent').get(function() {
  let score = 0;
  if (this.photos && this.photos.length >= 2) score += 30;
  else if (this.photos && this.photos.length >= 1) score += 15;
  if (this.bio && this.bio.trim().length > 10) score += 15;
  if (this.jobTitle || this.company || this.school) score += 10;
  if (this.interests && this.interests.length >= 3) score += 15;
  if (this.prompts && this.prompts.length >= 2) score += 20;
  if (this.relationshipGoal && this.relationshipGoal !== '') score += 5;
  if (this.lifestyle && Object.values(this.lifestyle).some(v => v !== '')) score += 5;
  return Math.min(score, 100);
});

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.birthday) return null;
  const today = new Date();
  const birthDate = new Date(this.birthday);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// Methods
userSchema.methods.toPublicProfile = function() {
  const completionScore = this.profileCompletionPercent;
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phone: this.phone,
    age: this.age,
    birthday: this.birthday,
    bio: this.bio,
    photos: this.photos,
    jobTitle: this.jobTitle,
    company: this.company,
    school: this.school,
    interests: this.interests,
    prompts: this.prompts,
    relationshipGoal: this.relationshipGoal,
    lifestyle: this.lifestyle,
    height: this.height,
    pronouns: this.pronouns,
    gender: this.gender,
    verified: this.verified,
    emailVerified: this.emailVerified,
    isOnline: this.isOnline,
    lastActive: this.lastActive,
    isProfileComplete: this.isProfileComplete,
    profileCompletionPercent: completionScore,
    subscription: this.subscription,
    isPremium: this.isPremium(),
    preferences: this.preferences,
    notificationSettings: this.notificationSettings,
    boost: this.boost,
  };
};

userSchema.methods.isPremium = function() {
  if (!['plus', 'gold', 'platinum'].includes(this.subscription?.type)) return false;
  // Check end date — treat no endDate as still active (e.g. dev mock)
  if (this.subscription?.endDate && this.subscription.endDate < new Date()) return false;
  return true;
};

userSchema.methods.canSwipe = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Reset daily count if needed
  if (this.dailySwipes.resetDate < today) {
    this.dailySwipes.count = 0;
    this.dailySwipes.resetDate = today;
  }
  
  const maxSwipes = this.isPremium() ? -1 : parseInt(process.env.MAX_SWIPES_PER_DAY || 100);
  return maxSwipes === -1 || this.dailySwipes.count < maxSwipes;
};

userSchema.methods.canSuperLike = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Reset daily count if needed
  if (this.dailySuperLikes.resetDate < today) {
    this.dailySuperLikes.count = 0;
    this.dailySuperLikes.resetDate = today;
  }
  
  const maxSuperLikes = this.isPremium() 
    ? parseInt(process.env.PREMIUM_SUPER_LIKES || 5)
    : parseInt(process.env.SUPER_LIKES_PER_DAY || 1);
  return this.dailySuperLikes.count < maxSuperLikes;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
