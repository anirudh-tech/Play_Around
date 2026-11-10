export type EmailOtpPurpose = 'EMAIL_VERIFY' | 'EMAIL_CHANGE' | 'PASSWORD_RESET';

export interface OtpEmail {
  subject: string;
  text: string;
  html: string;
}

const copy: Record<EmailOtpPurpose, { subject: string; heading: string; body: string }> = {
  EMAIL_VERIFY: {
    subject: 'Your PlayAround signup code',
    heading: 'Verify your email',
    body: 'Use this code to finish creating your PlayAround account.',
  },
  EMAIL_CHANGE: {
    subject: 'Confirm your new PlayAround email',
    heading: 'Confirm your new email',
    body: 'Use this code to confirm the new address on your PlayAround account.',
  },
  PASSWORD_RESET: {
    subject: 'Reset your PlayAround password',
    heading: 'Reset your password',
    body: 'Use this code to choose a new password. If you did not ask for this, you can ignore the email.',
  },
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function otpEmail(purpose: EmailOtpPurpose, code: string, ttlMin: number): OtpEmail {
  const { subject, heading, body } = copy[purpose];
  const safeCode = escapeHtml(code);
  const text = `${body}\n\nYour PlayAround code is ${code}. It expires in ${ttlMin} minutes.\n\nPlayAround will never ask you to forward this code.`;
  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#111827;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;color:#4ade80;font-size:12px;letter-spacing:2px;font-weight:bold;">PLAYAROUND</td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;color:#f8fafc;font-size:24px;font-weight:bold;">${escapeHtml(heading)}</td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;color:#94a3b8;font-size:15px;line-height:22px;">${escapeHtml(body)}</td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 8px;">
                <div style="display:inline-block;background:#1e293b;border-radius:12px;padding:16px 28px;color:#f8fafc;font-size:32px;letter-spacing:10px;font-weight:bold;font-family:Consolas,Monaco,monospace;">${safeCode}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;color:#64748b;font-size:13px;">This code expires in ${ttlMin} minutes. PlayAround will never ask you to forward it.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}
