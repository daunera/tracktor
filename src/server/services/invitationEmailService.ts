import { sendEmail } from './emailNotificationService';
import { env } from '$lib/config/env.server';
import * as m from '$lib/paraglide/messages';

export type InvitationEmailLocale = 'en' | 'hu';

export interface InvitationEmailData {
  inviterName: string;
  inviterUsername: string;
  vehicleName: string | null;
  recipientEmail: string;
  locale?: InvitationEmailLocale;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

export async function sendInvitationEmail(data: InvitationEmailData): Promise<{
  success: boolean;
  error?: string;
}> {
  const locale = data.locale ?? 'en';
  const localeOptions = { locale };
  const appUrl = env.BASE_URL || '';
  const inviter = data.inviterName || data.inviterUsername;
  const isAppInvitation = data.vehicleName === null;

  let subject: string;
  let body: string;
  let cta: string;

  if (isAppInvitation) {
    subject = m.app_invitation_email_subject({ inviter }, localeOptions);
    body = m.app_invitation_email_body({ inviter }, localeOptions);
    cta = m.app_invitation_email_cta({}, localeOptions);
  } else {
    const vehicle = data.vehicleName!;
    subject = m.invitation_email_subject({ inviter }, localeOptions);
    body = m.invitation_email_body({ inviter, vehicle }, localeOptions);
    cta = m.invitation_email_cta({}, localeOptions);
  }

  const about = m.invitation_email_about({}, localeOptions);
  const loginHint = m.invitation_email_login_hint({}, localeOptions);
  const ignore = m.invitation_email_ignore({}, localeOptions);

  const text = `${body}\n\n${about}\n\n${loginHint}\n\n${appUrl}\n\n${ignore}`;

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto;">
    <h2 style="color: #2563eb;">Tracktor</h2>
    <p>${escapeHtml(body)}</p>
    <p>${escapeHtml(about)}</p>
    <p>${escapeHtml(loginHint)}</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(appUrl)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold;">${escapeHtml(cta)}</a>
    </p>
    <p style="color: #6b7280; font-size: 12px;">${escapeHtml(ignore)}</p>
  </div>
</body>
</html>`;

  return await sendEmail({
    to: data.recipientEmail,
    subject,
    text,
    html
  });
}
