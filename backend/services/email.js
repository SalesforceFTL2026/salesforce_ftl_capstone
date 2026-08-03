import nodemailer from 'nodemailer';
import { resolve4 } from 'node:dns/promises';

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
 *
 * IPv4 pinning: Render has no outbound IPv6, but nodemailer 9 resolves BOTH
 * A and AAAA records and picks one at random (the `family` option is ignored),
 * so it intermittently chose an IPv6 address and failed with ENETUNREACH. We
 * resolve smtp.gmail.com to an IPv4 address ourselves and pass the IP as host —
 * nodemailer skips its own DNS when host is an IP literal. tls.servername keeps
 * TLS cert validation pinned to the real hostname (the cert won't match an IP).
 */
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_APP_PASSWORD;
const SMTP_HOST = 'smtp.gmail.com';

// Built lazily on first send and cached: the IPv4 lookup is async, and this
// keeps the same one-transporter-for-the-app behavior without a top-level await.
let transporterPromise = null;

function getTransporter() {
  if (!emailUser || !emailPass) return Promise.resolve(null);
  if (!transporterPromise) {
    transporterPromise = (async () => {
      let host = SMTP_HOST;
      try {
        const [ipv4] = await resolve4(SMTP_HOST);
        if (ipv4) host = ipv4;
      } catch {
        // Resolution failed — fall back to the hostname and let nodemailer try.
      }
      return nodemailer.createTransport({
        host,
        port: 465,
        secure: true,                   // 465 = implicit TLS
        auth: { user: emailUser, pass: emailPass },
        tls: { servername: SMTP_HOST }, // validate the cert against the hostname
      });
    })();
  }
  return transporterPromise;
}

/**
 * Send a single email. Returns true if sent, false if email isn't configured
 * or the send failed. Never throws — callers wrap their real work, not email,
 * so a mail hiccup can't break the action that triggered it.
 */
export async function sendEmail({ to, subject, text, html }) {
  const transporter = await getTransporter();
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
