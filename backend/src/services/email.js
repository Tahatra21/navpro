/**
 * Email notifications — aktif jika SMTP_HOST diset di environment.
 * Tanpa SMTP, pesan dicatat ke console (dev-friendly).
 */

import nodemailer from 'nodemailer';

export function isEmailEnabled() {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendEmail({ to, subject, text, html }) {
  if (!isEmailEnabled()) {
    console.log(`[email:skipped] To: ${to} | ${subject}`);
    return { ok: true, skipped: true };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'no-reply@navpro.app';

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  // Fail fast if config is wrong (but don't crash the app)
  try {
    await transport.verify();
  } catch (e) {
    console.error('[email:error] SMTP verify failed:', e);
    return { ok: false, error: 'SMTP verify failed' };
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    console.error('[email:error] send failed:', e);
    return { ok: false, error: 'SMTP send failed' };
  }
}

export async function notifyApprovalEvent({ to, projectName, projectCode, event, comment }) {
  const subject = `NAVPRO — ${event}: ${projectCode}`;
  const text = `Proyek: ${projectName}\nKode: ${projectCode}\nEvent: ${event}\n${comment ? `Komentar: ${comment}` : ''}`;
  return sendEmail({ to, subject, text });
}
