/**
 * Email Utility (Nodemailer)
 * Configure SMTP settings via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * In development (NODE_ENV !== 'production'), emails are logged to console.
 */

const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Development: log instead of sending
  return {
    sendMail: async (opts) => {
      console.log(`📧 [EMAIL-DEV] To: ${opts.to} | Subject: ${opts.subject}`);
      return { messageId: 'dev-mock' };
    },
  };
};

const FROM = () => `"Tender" <${process.env.SMTP_FROM || 'noreply@tender.app'}>`;
const DEEP_LINK = () => process.env.APP_DEEP_LINK || 'tender://';

/** Send email verification */
const sendVerificationEmail = async (email, firstName, token) => {
  const verifyUrl = `${DEEP_LINK()}verify-email?token=${token}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: FROM(),
    to: email,
    subject: 'Verify your Tender account',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#FF4458;font-size:32px;margin:0;">❤️ Tender</h1>
        </div>
        <h2 style="color:#333;">Welcome, ${firstName}!</h2>
        <p style="color:#555;">Please verify your email address to complete your account setup.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${verifyUrl}"
             style="background:linear-gradient(135deg,#FF4458,#FF6B6B);color:#fff;padding:16px 40px;
                    text-decoration:none;border-radius:30px;font-weight:bold;font-size:16px;display:inline-block;">
            Verify Email
          </a>
        </div>
        <p style="color:#999;font-size:13px;">This link expires in 24 hours.</p>
        <p style="color:#999;font-size:12px;">
          If you didn't create a Tender account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};

/** Send password reset email */
const sendPasswordResetEmail = async (email, firstName, token) => {
  const resetUrl = `${DEEP_LINK()}reset-password?token=${token}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: FROM(),
    to: email,
    subject: 'Reset your Tender password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#FF4458;font-size:32px;margin:0;">❤️ Tender</h1>
        </div>
        <h2 style="color:#333;">Reset Your Password</h2>
        <p style="color:#555;">Hi ${firstName}, we received a request to reset your Tender password.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}"
             style="background:linear-gradient(135deg,#FF4458,#FF6B6B);color:#fff;padding:16px 40px;
                    text-decoration:none;border-radius:30px;font-weight:bold;font-size:16px;display:inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color:#999;font-size:13px;">This link expires in 1 hour.</p>
        <p style="color:#999;font-size:12px;">
          If you didn't request a password reset, please ignore this email and your account will remain secure.
        </p>
      </div>
    `,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
