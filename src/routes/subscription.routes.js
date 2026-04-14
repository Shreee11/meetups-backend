const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { createCheckoutSession, createPaymentIntent, constructWebhookEvent, PERIOD_MONTHS } = require('../utils/stripe');
const { sendAndSaveNotification } = require('../utils/firebase');

const router = express.Router();

// Subscription plans
const PLANS = {
  plus: {
    name: 'Tender Plus',
    features: ['Unlimited Likes', 'Rewind', '5 Super Likes/day', 'Passport'],
    prices: {
      monthly: 9.99,
      sixMonths: 39.99,
      yearly: 59.99,
    },
  },
  gold: {
    name: 'Tender Gold',
    features: ['All Plus Features', 'See Who Likes You', 'Top Picks', '1 Boost/month'],
    prices: {
      monthly: 19.99,
      sixMonths: 89.99,
      yearly: 119.99,
    },
  },
  platinum: {
    name: 'Tender Platinum',
    features: ['All Gold Features', 'Message Before Match', 'Priority Likes', 'See Read Receipts'],
    prices: {
      monthly: 29.99,
      sixMonths: 134.99,
      yearly: 179.99,
    },
  },
};

// GET /api/v1/subscriptions/plans - Get available plans
router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/v1/subscriptions/me - Get current subscription
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    res.json({
      subscription: {
        type: user.subscription.type,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        isActive: user.subscription.endDate > new Date(),
        features: user.subscription.type !== 'free' 
          ? PLANS[user.subscription.type]?.features 
          : [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/subscriptions/subscribe - Create Stripe Checkout Session
router.post('/subscribe',
  [
    body('plan').isIn(['plus', 'gold', 'platinum']),
    body('period').isIn(['monthly', 'sixMonths', 'yearly']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { plan, period } = req.body;
      const user = await User.findById(req.userId);

      // If Stripe is not configured, fall back to mock activation (dev mode)
      if (!process.env.STRIPE_SECRET_KEY) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (PERIOD_MONTHS[period] || 1));

        const updatedUser = await User.findByIdAndUpdate(
          req.userId,
          { subscription: { type: plan, startDate, endDate } },
          { new: true }
        );

        await sendAndSaveNotification({
          userId: req.userId,
          fcmToken: user.fcmToken,
          type: 'subscription_activated',
          title: '🎉 Subscription Activated!',
          body: `Welcome to Tender ${plan.charAt(0).toUpperCase() + plan.slice(1)}! Enjoy your premium features.`,
          data: { plan },
        });

        return res.json({
          mode: 'dev',
          message: 'Subscription activated (dev mode — no payment required)',
          subscription: updatedUser.subscription,
          features: PLANS[plan]?.features || [],
        });
      }

      // Production: create Stripe Checkout Session
      const session = await createCheckoutSession(user, plan, period);

      res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/subscriptions/cancel - Cancel subscription
router.post('/cancel', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.subscription.type === 'free') {
      return res.status(400).json({ error: 'No active subscription' });
    }
    
    // In production, cancel with payment provider
    // Subscription remains active until endDate
    
    res.json({
      message: 'Subscription cancelled. You will retain access until your billing period ends.',
      endDate: user.subscription.endDate,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/subscriptions/restore - Restore purchases (iOS/Android)
router.post('/restore',
  [
    body('receipt').notEmpty(),
    body('platform').isIn(['ios', 'android']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // TODO: Implement platform receipt verification
      // iOS: https://buy.itunes.apple.com/verifyReceipt
      // Android: Google Play Developer API
      res.json({ message: 'Receipt verification not yet implemented. Contact support.' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/subscriptions/webhook — Stripe webhook (no auth middleware)
// Note: This route is registered in server.js with raw body parser
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { userId, plan, period } = session.metadata || {};

      if (userId && plan && period) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + (PERIOD_MONTHS[period] || 1));

        const user = await User.findByIdAndUpdate(
          userId,
          { subscription: { type: plan, startDate, endDate } },
          { new: true }
        );

        if (user) {
          await sendAndSaveNotification({
            userId: user._id,
            fcmToken: user.fcmToken,
            type: 'subscription_activated',
            title: '🎉 Subscription Activated!',
            body: `Welcome to Tender ${plan.charAt(0).toUpperCase() + plan.slice(1)}!`,
            data: { plan },
          });
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.type': 'free',
          'subscription.endDate': new Date(),
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// POST /api/v1/subscriptions/boost — Activate a profile boost
router.post('/boost', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.isPremium()) {
      return res.status(403).json({ error: 'Premium subscription required', upgrade: true });
    }

    const boostExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await User.findByIdAndUpdate(req.userId, {
      'boost.active': true,
      'boost.expiresAt': boostExpiresAt,
    });

    res.json({
      message: 'Boost activated for 30 minutes!',
      expiresAt: boostExpiresAt,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
