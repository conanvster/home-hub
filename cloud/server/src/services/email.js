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

module.exports = { sendPasswordReset, sendTelegramCode };
