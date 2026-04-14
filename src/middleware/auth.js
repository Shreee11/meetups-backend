const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.userId).select('-refreshToken');
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!user.active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }

      req.user = user;
      req.userId = user._id;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-refreshToken');
      
      if (user && user.active) {
        req.user = user;
        req.userId = user._id;
      }
    } catch (error) {
      // Token invalid but optional, continue without user
    }
    
    next();
  } catch (error) {
    next();
  }
};

const premiumRequired = (req, res, next) => {
  if (!req.user.isPremium()) {
    return res.status(403).json({ 
      error: 'Premium subscription required',
      upgrade: true,
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  optionalAuth,
  premiumRequired,
};
