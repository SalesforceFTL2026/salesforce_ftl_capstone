import nodemailer from 'nodemailer';

/**
 * Email service (Gmail SMTP via Nodemailer).
 *
 * One shared transporter for the whole app, pointed at Gmail's SMTP server.
 * Credentials come from env:
 *   - EMAIL_USER:          your Gmail address
 *   - EMAIL_APP_PASSWORD:  a 16-char Google "App Password" (NOT your normal
 *                          Gmail password). Create one at Google Account ->
 *                          Security -> 2-Step Verification -> App passwords.
 *
 * If either var is missing we leave the transporter null so the server still
 * boots — email simply no-ops. This mirrors how the AI providers degrade when
 * a key is absent (see services/ai): a missing email config is never fatal.
 */
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_APP_PASSWORD;

const transporter = emailUser && emailPass
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,          // 465 = implicit TLS
      auth: { user: emailUser, pass: emailPass },
      family: 4,             // force IPv4 — Render has no outbound IPv6
    })
  : null;

/**
 * Send a single email. Returns true if sent, false if email isn't configured
 * or the send failed. Never throws — callers wrap their real work, not email,
 * so a mail hiccup can't break the action that triggered it.
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    console.warn('Email not configured (EMAIL_USER / EMAIL_APP_PASSWORD unset); skipping send.');
    return false;
  }
  if (!to) return false;

  try {
    await transporter.sendMail({
      from: `"MapResponse" <${emailUser}>`,
      to,
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}
