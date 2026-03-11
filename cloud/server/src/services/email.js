const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendMail(to, subject, html) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("[Email] Not configured, skipping:", subject, "->", to);
    return;
  }
  await getTransporter().sendMail({
    from: `Home Hub <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

async function sendTelegramCode(to, code) {
  await sendMail(
    to,
    "Прив'язка Telegram — Home Hub",
    `<p>Для прив'язки Telegram надішліть боту команду:</p>
     <p><strong>/confirm ${code}</strong></p>
     <p>Код дійсний 15 хвилин.</p>
     <p>Якщо ви не запитували прив'язку — проігноруйте цей лист.</p>`
  );
}

async function sendPasswordReset(to, token) {
  const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendMail(
    to,
    "Скидання паролю — Home Hub",
    `<p>Для скидання паролю перейдіть за посиланням:</p>
     <p><a href="${url}">${url}</a></p>
     <p>Посилання дійсне 1 годину.</p>
     <p>Якщо ви не запитували скидання — проігноруйте цей лист.</p>`
  );
}

async function sendInvite(to, token, invitedBy) {
  const url = `${process.env.FRONTEND_URL}/invite?token=${token}`;
  await sendMail(
    to,
    "Запрошення до Home Hub",
    `<p><strong>${invitedBy}</strong> запрошує вас до <strong>Home Hub</strong> — сімейного центру керування.</p>
     <p>Натисніть посилання щоб прийняти запрошення та встановити пароль:</p>
     <p><a href="${url}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Прийняти запрошення</a></p>
     <p style="color:#888;font-size:12px">Посилання дійсне 7 днів. Якщо ви не очікували цього листа — проігноруйте його.</p>`
  );
}

async function sendVerification(to, token) {
  const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendMail(
    to,
    "Підтвердження email — Home Hub",
    `<p>Дякуємо за реєстрацію в <strong>Home Hub</strong>!</p>
     <p>Будь ласка, підтвердіть свою електронну пошту протягом 12 годин:</p>
     <p><a href="${url}" style="background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Підтвердити email</a></p>
     <p style="color:#888;font-size:12px">Якщо ви не реєструвалися — проігноруйте цей лист.</p>`
  );
}

module.exports = { sendPasswordReset, sendTelegramCode, sendInvite, sendVerification };
