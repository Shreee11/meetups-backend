/**
 * Stripe Payment Utility
 * Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
 *
 * Stripe Price IDs map to subscription plans.
 * Create products/prices in your Stripe dashboard and set them in .env:
 *   STRIPE_PRICE_PLUS_MONTHLY, STRIPE_PRICE_PLUS_6MONTHS, STRIPE_PRICE_PLUS_YEARLY
 *   STRIPE_PRICE_GOLD_MONTHLY, STRIPE_PRICE_GOLD_6MONTHS, STRIPE_PRICE_GOLD_YEARLY
 *   STRIPE_PRICE_PLATINUM_MONTHLY, STRIPE_PRICE_PLATINUM_6MONTHS, STRIPE_PRICE_PLATINUM_YEARLY
 */

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

const PLAN_PRICE_IDS = () => ({
  plus: {
    monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY || 'price_plus_monthly',
    sixMonths: process.env.STRIPE_PRICE_PLUS_6MONTHS || 'price_plus_6months',
    yearly: process.env.STRIPE_PRICE_PLUS_YEARLY || 'price_plus_yearly',
  },
  gold: {
    monthly: process.env.STRIPE_PRICE_GOLD_MONTHLY || 'price_gold_monthly',
    sixMonths: process.env.STRIPE_PRICE_GOLD_6MONTHS || 'price_gold_6months',
    yearly: process.env.STRIPE_PRICE_GOLD_YEARLY || 'price_gold_yearly',
  },
  platinum: {
    monthly: process.env.STRIPE_PRICE_PLATINUM_MONTHLY || 'price_platinum_monthly',
    sixMonths: process.env.STRIPE_PRICE_PLATINUM_6MONTHS || 'price_platinum_6months',
    yearly: process.env.STRIPE_PRICE_PLATINUM_YEARLY || 'price_platinum_yearly',
  },
});

/** Create or retrieve Stripe customer for a user */
const getOrCreateCustomer = async (stripe, user) => {
  if (user.stripeCustomerId) {
    return await stripe.customers.retrieve(user.stripeCustomerId);
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.firstName,
    metadata: { userId: user._id.toString() },
  });
  await require('../models').User.findByIdAndUpdate(user._id, {
    stripeCustomerId: customer.id,
  });
  return customer;
};

/**
 * Create a Stripe Checkout Session for a subscription plan.
 * The Flutter app opens this URL in a WebView / url_launcher.
 */
const createCheckoutSession = async (user, plan, period) => {
  const stripe = getStripe();
  const priceId = PLAN_PRICE_IDS()[plan]?.[period];
  if (!priceId) throw new Error('Invalid plan or period');

  const customer = await getOrCreateCustomer(stripe, user);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL || 'https://tender.app'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL || 'https://tender.app'}/payment/cancel`,
    metadata: {
      userId: user._id.toString(),
      plan,
      period,
    },
    subscription_data: {
      metadata: {
        userId: user._id.toString(),
        plan,
        period,
      },
    },
  });

  return session;
};

/** Create a one-time PaymentIntent (e.g., for Boosts or SuperLike packs) */
const createPaymentIntent = async (user, amountUsd, description, metadata = {}) => {
  const stripe = getStripe();
  const customer = await getOrCreateCustomer(stripe, user);

  return await stripe.paymentIntents.create({
    amount: Math.round(amountUsd * 100),
    currency: 'usd',
    customer: customer.id,
    description,
    metadata: {
      userId: user._id.toString(),
      ...metadata,
    },
  });
};

/** Verify and construct Stripe webhook event */
const constructWebhookEvent = (rawBody, signature) => {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

const PERIOD_MONTHS = {
  monthly: 1,
  sixMonths: 6,
  yearly: 12,
};

module.exports = {
  createCheckoutSession,
  createPaymentIntent,
  constructWebhookEvent,
  PERIOD_MONTHS,
};
