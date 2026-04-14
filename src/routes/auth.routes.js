const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Verification } = require('../models');
const { authLimiter, smsLimiter } = require('../middleware/rateLimiter');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

// Generate verification code
const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d' }
  );
  
  return { accessToken, refreshToken };
};

// Send SMS (mock for development)
const sendSMS = async (phone, code) => {
  // In production, use Twilio
  if (process.env.NODE_ENV === 'production') {
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    await twilio.messages.create({
      body: `Your Tender verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
  } else {
    console.log(`📱 SMS to ${phone}: Your code is ${code}`);
  }
};

// POST /api/v1/auth/send-code
router.post('/send-code', 
  smsLimiter,
  [
    body('phone').isMobilePhone().withMessage('Invalid phone number'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone } = req.body;
      const code = generateCode();
      
      // Delete any existing verification for this phone
      await Verification.deleteMany({ phone });
      
      // Create new verification
      const verification = await Verification.create({
        phone,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });
      
      // Send SMS
      await sendSMS(phone, code);
      
      res.json({ 
        message: 'Verification code sent',
        expiresAt: verification.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/verify-code
router.post('/verify-code',
  authLimiter,
  [
    body('phone').isMobilePhone().withMessage('Invalid phone number'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid code'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone, code } = req.body;
      
      const verification = await Verification.findOne({
        phone,
        expiresAt: { $gt: new Date() },
      });
      
      if (!verification) {
        return res.status(400).json({ error: 'Verification code expired or not found' });
      }
      
      if (verification.attempts >= 5) {
        await verification.deleteOne();
        return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
      }
      
      if (verification.code !== code) {
        verification.attempts += 1;
        await verification.save();
        return res.status(400).json({ error: 'Invalid code' });
      }
      
      // Mark as verified
      verification.verified = true;
      await verification.save();
      
      // Check if user exists
      let user = await User.findOne({ phone });
      let isNewUser = false;
      
      if (!user) {
        isNewUser = true;
      } else {
        // Existing user - generate tokens
        const { accessToken, refreshToken } = generateTokens(user._id);
        user.refreshToken = refreshToken;
        user.phoneVerified = true;
        user.lastActive = new Date();
        await user.save();
        
        return res.json({
          isNewUser: false,
          accessToken,
          refreshToken,
          user: user.toPublicProfile(),
        });
      }
      
      res.json({
        isNewUser: true,
        verificationToken: jwt.sign(
          { phone, verified: true },
          process.env.JWT_SECRET,
          { expiresIn: '30m' }
        ),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/register
router.post('/register',
  authLimiter,
  [
    body('verificationToken').notEmpty().withMessage('Verification token required'),
    body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('birthday').isISO8601().withMessage('Invalid birthday'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
    body('photos').optional().isArray({ max: 9 }).withMessage('Maximum 9 photos allowed'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { verificationToken, firstName, lastName, birthday, gender, bio, photos, location } = req.body;
      
      // Verify the verification token
      let decoded;
      try {
        decoded = jwt.verify(verificationToken, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }
      
      if (!decoded.verified) {
        return res.status(400).json({ error: 'Phone not verified' });
      }
      
      // Check if user already exists
      let user = await User.findOne({ phone: decoded.phone });
      if (user) {
        return res.status(400).json({ error: 'User already exists' });
      }
      
      // Validate age (must be 18+)
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        return res.status(400).json({ error: 'You must be at least 18 years old' });
      }
      
      // Create user
      user = await User.create({
        phone: decoded.phone,
        phoneVerified: true,
        firstName,
        lastName,
        birthday: birthDate,
        gender,
        bio: bio || '',
        photos: photos ? photos.map((photo, index) => ({
          url: photo.url,
          publicId: photo.publicId || `photo_${index}`,
          order: index,
          isMain: index === 0,
        })) : [],
        location: location ? {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
          city: location.city,
          country: location.country,
        } : undefined,
      });
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);
      user.refreshToken = refreshToken;
      await user.save();
      
      // Clean up verification
      await Verification.deleteMany({ phone: decoded.phone });
      
      res.status(201).json({
        accessToken,
        refreshToken,
        user: user.toPublicProfile(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/refresh
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;
      
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      
      const user = await User.findOne({
        _id: decoded.userId,
        refreshToken,
      });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
      
      // Generate new tokens
      const tokens = generateTokens(user._id);
      user.refreshToken = tokens.refreshToken;
      await user.save();
      
      res.json(tokens);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(decoded.userId, {
          refreshToken: null,
          isOnline: false,
        });
      } catch (error) {
        // Token invalid, just proceed with logout
      }
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/login - Email/Password login
router.post('/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      
      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Check password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Check if user is active
      if (!user.active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);
      user.refreshToken = refreshToken;
      user.lastActive = new Date();
      user.isOnline = true;
      await user.save();
      
      res.json({
        token: accessToken,
        refreshToken,
        user: user.toPublicProfile(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/register-email - Email/Password registration (profile optional, completed later)
router.post('/register-email',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      
      // Create stub user (profile to be completed via /users/me/complete-profile)
      const user = await User.create({
        email: email.toLowerCase(),
        password,
      });
      
      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);
      user.refreshToken = refreshToken;

      // Issue email verification token
      const emailToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto.createHash('sha256').update(emailToken).digest('hex');
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      // Send verification email (non-blocking)
      sendVerificationEmail(email, 'there', emailToken).catch(err =>
        console.error('Email send error:', err.message)
      );
      
      res.status(201).json({
        token: accessToken,
        refreshToken,
        user: user.toPublicProfile(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/auth/verify-email?token= — Verify email address
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/auth/resend-verification — Resend email verification
router.post('/resend-verification',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      // Always return success to prevent user enumeration
      if (!user || user.emailVerified) {
        return res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
      user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      sendVerificationEmail(email, user.firstName || 'there', token).catch(err =>
        console.error('Email send error:', err.message)
      );

      res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/forgot-password — Request password reset
router.post('/forgot-password',
  authLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      // Prevent user enumeration
      if (!user) {
        return res.json({ message: 'If that email is registered, a password reset link has been sent.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      sendPasswordResetEmail(email, user.firstName || 'there', token).catch(err =>
        console.error('Email send error:', err.message)
      );

      res.json({ message: 'If that email is registered, a password reset link has been sent.' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/reset-password — Reset password with token
router.post('/reset-password',
  authLimiter,
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      user.password = password; // will be hashed by pre-save hook
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.refreshToken = undefined; // invalidate all sessions
      await user.save();

      res.json({ message: 'Password reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
