// Перевірка листів: виконується ВСЕРЕДИНІ контейнера cloud (docker exec … node - < email-check.cjs).
// Підміняє транспорт nodemailer на jsonTransport (без мережі) і викликає всі функції services/email.js
// з тим nodemailer, що реально встановлений у цій версії.
const nodemailer = require("/app/node_modules/nodemailer");
const sent = [];
const realCreate = nodemailer.createTransport;
nodemailer.createTransport = (opts) => {
  const t = realCreate({ jsonTransport: true });
  const send = t.sendMail.bind(t);
  t.sendMail = async (msg) => {
    const info = await send(msg);
    sent.push({ requested: opts.service, ...JSON.parse(info.message) });
    return info;
  };
  return t;
};
process.env.EMAIL_USER = "sender@reg.test";
process.env.EMAIL_PASS = "not-used";
const email = require("/app/src/services/email.js");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: ok ? "" : String(detail).slice(0, 300) });
(async () => {
  const calls = [
    ["sendPasswordReset", ["to@reg.test", "tok-reset"]],
    ["sendTelegramCode", ["to@reg.test", "123456"]],
    ["sendInvite", ["to@reg.test", "tok-invite", "admin@reg.test"]],
    ["sendVerification", ["to@reg.test", "tok-verify"]],
  ];
  for (const [fn, args] of calls) {
    const before = sent.length;
    try {
      await email[fn](...args);
      const m = sent[before];
      const html = m?.html || "";
      check(`лист ${fn}`, m && m.to?.[0]?.address === "to@reg.test" && m.subject && html.length > 20 && m.requested === "gmail",
        JSON.stringify(m).slice(0, 200));
      const token = args[1];
      check(`лист ${fn}: містить ${token}`, html.includes(token), html.slice(0, 200));
    } catch (e) {
      check(`лист ${fn}`, false, e.stack);
    }
  }
  check("nodemailer версія", true);
  console.log(JSON.stringify({ nodemailer: require("/app/node_modules/nodemailer/package.json").version, results }));
})();
