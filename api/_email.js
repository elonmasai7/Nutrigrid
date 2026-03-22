import nodemailer from 'nodemailer';

let cachedTransport = null;

const getTransport = () => {
  if (cachedTransport) return cachedTransport;
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  cachedTransport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });

  return cachedTransport;
};

const sendPilotNotification = async (entry) => {
  const transport = getTransport();
  const notify = process.env.NOTIFY_EMAIL;
  if (!transport || !notify) return;

  await transport.sendMail({
    from: process.env.MAIL_FROM || 'Nutrigrid <no-reply@nutrigrid.local>',
    to: notify,
    subject: 'New Nutrigrid pilot request',
    text: `New request from ${entry.name} (${entry.organization}) in ${entry.region}.\nEmail: ${entry.email}\nMessage: ${entry.message || 'No notes'}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1c2421;">
        <h2 style="color:#2f4c3a;">New Nutrigrid pilot request</h2>
        <p><strong>Name:</strong> ${entry.name}</p>
        <p><strong>Organization:</strong> ${entry.organization}</p>
        <p><strong>Region:</strong> ${entry.region}</p>
        <p><strong>Email:</strong> ${entry.email}</p>
        <p><strong>Message:</strong> ${entry.message || 'No notes'}</p>
        <p style="margin-top:24px;color:#5f6b66;">Log in to the admin dashboard to update the status.</p>
      </div>
    `,
  });
};

export { sendPilotNotification };
