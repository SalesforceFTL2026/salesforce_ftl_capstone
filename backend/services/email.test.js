import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the transport boundary so these tests are fast, free, and offline — same
// pattern as the AI tests (voiceAgent.test.js). nodemailer.createTransport is a
// spy that hands back a fake transporter whose sendMail we control per test.
const sendMail = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

// email.js reads EMAIL_USER / EMAIL_APP_PASSWORD and builds its transporter at
// IMPORT time, so each test must set env first, then import the module fresh.
// resetModules + dynamic import gives every test its own evaluation of the file.
async function loadEmail(env) {
  vi.resetModules();
  createTransport.mockClear();
  sendMail.mockReset();
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_APP_PASSWORD;
  if (env.user !== undefined) process.env.EMAIL_USER = env.user;
  if (env.pass !== undefined) process.env.EMAIL_APP_PASSWORD = env.pass;
  return import('./email.js');
}

const CONFIGURED = { user: 'relief@mapresponse.org', pass: 'abcdefghijklmnop' };

const message = {
  to: 'seeker@example.com',
  subject: 'Someone offered to help with your request',
  text: 'Hi Sam, Alex offered to help.',
  html: '<p>Hi Sam, Alex offered to help.</p>',
};

// Keep env from one test leaking into the next.
const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('sendEmail when email is not configured', () => {
  it('no-ops (returns false, never builds a transporter) when both vars are unset', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendEmail } = await loadEmail({});

    const result = await sendEmail(message);

    expect(result).toBe(false);
    // The whole degrade-gracefully guarantee: no transporter, so no send attempt.
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('stays disabled when only the user is set (a half-config is not usable)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendEmail } = await loadEmail({ user: CONFIGURED.user });

    expect(await sendEmail(message)).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('stays disabled when only the password is set', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { sendEmail } = await loadEmail({ pass: CONFIGURED.pass });

    expect(await sendEmail(message)).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
});

describe('sendEmail when configured', () => {
  it('sends with the right envelope and returns true', async () => {
    sendMail.mockResolvedValue({ messageId: 'abc123' });
    const { sendEmail } = await loadEmail(CONFIGURED);

    const result = await sendEmail(message);

    expect(result).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({
      from: `"MapResponse" <${CONFIGURED.user}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  });

  it('builds the Gmail SMTP transporter from the env credentials', async () => {
    sendMail.mockResolvedValue({});
    await loadEmail(CONFIGURED);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4, // forces IPv4 — Render has no outbound IPv6
        auth: { user: CONFIGURED.user, pass: CONFIGURED.pass },
      })
    );
  });

  it('returns false without sending when no recipient is given', async () => {
    const { sendEmail } = await loadEmail(CONFIGURED);

    expect(await sendEmail({ ...message, to: undefined })).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('swallows a send failure and returns false rather than throwing', async () => {
    // A mail hiccup must never break the action that triggered it (the volunteer
    // "I can help" flow) — the caller wraps its real work, not the email.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendEmail } = await loadEmail(CONFIGURED);
    // Set after loadEmail — it resets sendMail, which would otherwise wipe this.
    sendMail.mockRejectedValue(new Error('SMTP 535: bad credentials'));

    await expect(sendEmail(message)).resolves.toBe(false);
  });
});
