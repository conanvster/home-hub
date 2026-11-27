// Регресійні тести home-hub: cloud/server + local. Запускає run.sh у мережі Docker без інтернету.
//
//   node suite.mjs full     — повний набір на чистій базі
//   node suite.mjs seed     — сценарій оновлення, крок 1: стара версія створює дані (пише /out/seed-data.json)
//   node suite.mjs verify   — сценарій оновлення, крок 2: нова версія на тій самій базі
//   node suite.mjs local    — local після синхронізації з cloud (вхід хмарним паролем, дані)
//
// Результат — /out/<фаза>.json: [{ name, ok, detail }]. Код виходу 0 лише якщо все ok.
import net from "node:net";
import fs from "node:fs";
import { io } from "socket.io-client";
import { MongoClient } from "mongodb";

const CLOUD = process.env.CLOUD_URL || "http://cloud:3001";
const LOCAL = process.env.LOCAL_URL || "http://local:3002";
const TCP_HOST = process.env.TCP_HOST || "cloud";
const TCP_PORT = Number(process.env.TCP_PORT || 8090);
const MONGO = process.env.MONGO_URL || "mongodb://mongo:27017";
const SYNC_SECRET = process.env.SYNC_SECRET || "reg-sync-secret";
const OUT = process.env.OUT_DIR || "/out";
const phase = process.argv[2] || "full";

const results = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Відомі вади, що були й до змін: перевірка лишається (покаже, коли ваду виправлять),
// але не валить прогін. Ключ — назва перевірки.
const KNOWN = {};
function check(name, ok, detail = "") {
  const known = !ok && KNOWN[name];
  results.push({ name, ok: !!ok, known: known || undefined, detail: ok ? "" : String(detail).slice(0, 300) });
}
async function step(name, fn) {
  try { await fn(); } catch (e) { check(name, false, "виняток: " + (e?.stack || e)); }
}
async function api(base, method, path, { body, token, headers = {} } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}
const cloud = (m, p, o) => api(CLOUD, m, p, o);
const local = (m, p, o) => api(LOCAL, m, p, o);
const desc = (r) => `HTTP ${r.status} ${typeof r.data === "string" ? r.data.slice(0, 120) : JSON.stringify(r.data).slice(0, 160)}`;

function tcpSend(line) {
  return new Promise((resolve, reject) => {
    // Приймач трекерів сам з'єднання не закриває (трекер тримає його відкритим) —
    // після відправки чекаємо трохи й закриваємо самі.
    const s = net.connect(TCP_PORT, TCP_HOST, () => s.write(line, () => setTimeout(() => { s.destroy(); resolve(); }, 150)));
    s.on("error", reject);
    s.setTimeout(5000, () => { s.destroy(); reject(new Error("TCP timeout")); });
  });
}
function sock(token) {
  return new Promise((resolve) => {
    const s = io(CLOUD, { auth: token ? { token } : {}, transports: ["websocket"], reconnection: false, timeout: 5000 });
    const got = { location: [], chat: [] };
    s.on("location", (l) => got.location.push(l.imei));
    s.on("chat:message", (m) => got.chat.push(m.text));
    s.on("connect", () => resolve({ ok: true, s, got }));
    s.on("connect_error", (e) => resolve({ ok: false, err: e.message, s, got }));
  });
}
async function waitFor(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(100); }
  return false;
}
async function login(base, email, password) {
  const r = await api(base, "POST", "/api/auth/login", { body: { email, password } });
  return r.data?.token || null;
}

let mongo, db;
async function openDb() {
  mongo = new MongoClient(MONGO);
  await mongo.connect();
  db = mongo.db(process.env.CLOUD_DB || "hh");
}

// ───────────────────────────── повний набір ─────────────────────────────
async function full() {
  const P = { a: "Passw0rd-a", b: "Passw0rd-b", c: "Passw0rd-c" };
  const T = {};
  const id = {};

  await step("базові: health/version/settings", async () => {
    check("health 200", (await cloud("GET", "/api/health")).status === 200);
    check("version 200", (await cloud("GET", "/api/version")).status === 200);
    const s = await cloud("GET", "/api/settings");
    check("settings публічні", s.status === 200 && "apkUrl" in s.data, desc(s));
  });

  await step("реєстрація", async () => {
    const r = await cloud("POST", "/api/auth/register", { body: { email: "a@reg.test", password: P.a } });
    check("register 201 + token", r.status === 201 && r.data.token, desc(r));
    check("register: роль viewer", r.data?.user?.role === "viewer", desc(r));
    check("register дубль 409", (await cloud("POST", "/api/auth/register", { body: { email: "a@reg.test", password: P.a } })).status === 409);
    check("register короткий пароль 400", (await cloud("POST", "/api/auth/register", { body: { email: "x@reg.test", password: "12345" } })).status === 400);
    check("register без полів 400", (await cloud("POST", "/api/auth/register", { body: {} })).status === 400);
    for (const u of ["b", "c"]) await cloud("POST", "/api/auth/register", { body: { email: `${u}@reg.test`, password: P[u] } });
  });

  await step("вхід", async () => {
    for (const u of ["a", "b", "c"]) T[u] = await login(CLOUD, `${u}@reg.test`, P[u]);
    check("login a/b/c", T.a && T.b && T.c);
    check("login неправильний пароль 401", (await cloud("POST", "/api/auth/login", { body: { email: "a@reg.test", password: "wrong-pass" } })).status === 401);
    check("login невідомий email 401", (await cloud("POST", "/api/auth/login", { body: { email: "nobody@reg.test", password: "whatever1" } })).status === 401);
    check("login без полів 400", (await cloud("POST", "/api/auth/login", { body: {} })).status === 400);
    const me = await cloud("GET", "/api/auth/me", { token: T.a });
    check("me: email", me.status === 200 && me.data.email === "a@reg.test", desc(me));
    id.a = me.data._id;
    id.b = (await cloud("GET", "/api/auth/me", { token: T.b })).data._id;
    id.c = (await cloud("GET", "/api/auth/me", { token: T.c })).data._id;
    check("me без токена 401", (await cloud("GET", "/api/auth/me")).status === 401);
    check("me зіпсований токен 401", (await cloud("GET", "/api/auth/me", { token: "abc.def.ghi" })).status === 401);
    const h = await db.collection("users").findOne({ email: "a@reg.test" });
    check("пароль у базі — хеш bcrypt", /^\$2[aby]\$10\$/.test(h?.password || ""), String(h?.password).slice(0, 7));
  });

  await step("підтвердження email", async () => {
    const u = await db.collection("users").findOne({ email: "a@reg.test" });
    const r = await cloud("GET", "/api/auth/verify-email?token=" + u.verificationToken);
    check("verify-email 200", r.status === 200, desc(r));
    check("me: emailVerified", (await cloud("GET", "/api/auth/me", { token: T.a })).data.emailVerified === true);
    check("verify-email повторно 400", (await cloud("GET", "/api/auth/verify-email?token=" + u.verificationToken)).status === 400);
  });

  await step("зміна пароля", async () => {
    check("change-password неправильний поточний 400",
      (await cloud("POST", "/api/auth/change-password", { token: T.c, body: { currentPassword: "nope-nope", newPassword: "NewPass-c1" } })).status === 400);
    const r = await cloud("POST", "/api/auth/change-password", { token: T.c, body: { currentPassword: P.c, newPassword: "NewPass-c1" } });
    check("change-password 200", r.status === 200, desc(r));
    check("вхід новим паролем", !!(await login(CLOUD, "c@reg.test", "NewPass-c1")));
    check("старий пароль не діє", !(await login(CLOUD, "c@reg.test", P.c)));
    P.c = "NewPass-c1";
  });

  await step("відновлення пароля", async () => {
    const r = await cloud("POST", "/api/auth/forgot-password", { body: { email: "b@reg.test" } });
    check("forgot-password 200", r.status === 200, desc(r));
    check("forgot-password невідомий email 200 (без розкриття)", (await cloud("POST", "/api/auth/forgot-password", { body: { email: "zz@reg.test" } })).status === 200);
    const u = await db.collection("users").findOne({ email: "b@reg.test" });
    check("resetToken записано", !!u?.resetToken);
    check("reset-password неправильний токен 400", (await cloud("POST", "/api/auth/reset-password", { body: { token: "bad", password: "Reset-b-1" } })).status === 400);
    const rr = await cloud("POST", "/api/auth/reset-password", { body: { token: u.resetToken, password: "Reset-b-1" } });
    check("reset-password 200", rr.status === 200, desc(rr));
    check("вхід після скидання", !!(await login(CLOUD, "b@reg.test", "Reset-b-1")));
    P.b = "Reset-b-1";
    T.b = await login(CLOUD, "b@reg.test", P.b);
  });

  await step("push-token і telegram-link", async () => {
    check("push-token без поля 400", (await cloud("POST", "/api/auth/push-token", { token: T.c, body: {} })).status === 400);
    check("push-token 200", (await cloud("POST", "/api/auth/push-token", { token: T.c, body: { token: "ExponentPushToken[reg]" } })).status === 200);
    const t = await cloud("POST", "/api/auth/telegram-link", { token: T.a });
    check("telegram-link: 6-значний код", /^\d{6}$/.test(t.data?.code || ""), desc(t));
    check("telegram-link DELETE 200", (await cloud("DELETE", "/api/auth/telegram-link", { token: T.a })).status === 200);
  });

  await step("адмінка", async () => {
    await db.collection("users").updateOne({ email: "a@reg.test" }, { $set: { role: "admin" } });
    T.a = await login(CLOUD, "a@reg.test", P.a);
    check("не-адмін: admin/users 403", (await cloud("GET", "/api/admin/users", { token: T.b })).status === 403);
    const u = await cloud("GET", "/api/admin/users", { token: T.a });
    check("admin/users 200", u.status === 200 && Array.isArray(u.data) && u.data.length === 3, desc(u));
    check("admin/users без паролів", Array.isArray(u.data) && u.data.every((x) => !("password" in x)));
    const inv = await cloud("POST", "/api/admin/invite", { token: T.a, body: { email: "d@reg.test", role: "member" } });
    check("invite 200", inv.status === 200, desc(inv));
    check("invite дубль 409", (await cloud("POST", "/api/admin/invite", { token: T.a, body: { email: "d@reg.test" } })).status === 409);
    check("invite погана роль 400", (await cloud("POST", "/api/admin/invite", { token: T.a, body: { email: "e@reg.test", role: "root" } })).status === 400);
    const d = await db.collection("users").findOne({ email: "d@reg.test" });
    const g = await cloud("GET", "/api/auth/accept-invite/" + d.inviteToken);
    check("accept-invite GET", g.status === 200 && g.data.email === "d@reg.test", desc(g));
    check("accept-invite короткий пароль 400", (await cloud("POST", "/api/auth/accept-invite/" + d.inviteToken, { body: { password: "123" } })).status === 400);
    const ap = await cloud("POST", "/api/auth/accept-invite/" + d.inviteToken, { body: { password: "Invite-d-1" } });
    check("accept-invite POST + token", ap.status === 200 && ap.data.token, desc(ap));
    check("вхід запрошеного", !!(await login(CLOUD, "d@reg.test", "Invite-d-1")));
    check("accept-invite повторно 400", (await cloud("POST", "/api/auth/accept-invite/" + d.inviteToken, { body: { password: "Invite-d-2" } })).status === 400);
    const pr = await cloud("PATCH", "/api/admin/users/" + id.b, { token: T.a, body: { role: "member" } });
    check("змінити роль", pr.status === 200 && pr.data.role === "member", desc(pr));
    check("погана роль 400", (await cloud("PATCH", "/api/admin/users/" + id.b, { token: T.a, body: { role: "god" } })).status === 400);
    check("aiAgentAccess", (await cloud("PATCH", "/api/admin/users/" + id.a, { token: T.a, body: { aiAgentAccess: true } })).data?.aiAgentAccess === true);
    check("settings PUT адмін", (await cloud("PUT", "/api/settings", { token: T.a, body: { apkUrl: "https://reg.test/app.apk" } })).data?.apkUrl === "https://reg.test/app.apk");
    check("settings PUT не-адмін 403", (await cloud("PUT", "/api/settings", { token: T.b, body: { apkUrl: "x" } })).status === 403);
    check("settings GET бачить зміну", (await cloud("GET", "/api/settings")).data?.apkUrl === "https://reg.test/app.apk");
    check("admin/telegram 200", (await cloud("GET", "/api/admin/telegram", { token: T.a })).status === 200);
    const dId = (await db.collection("users").findOne({ email: "d@reg.test" }))._id.toString();
    check("видалити користувача", (await cloud("DELETE", "/api/admin/users/" + dId, { token: T.a })).status === 200);
    check("видалити себе 400", (await cloud("DELETE", "/api/admin/users/" + id.a, { token: T.a })).status === 400);
    check("видалений не входить", !(await login(CLOUD, "d@reg.test", "Invite-d-1")));
  });

  await step("трекери", async () => {
    const t = await cloud("POST", "/api/trackers", { token: T.a, body: { name: "Авто", imei: "111111" } });
    check("створити трекер", [200, 201].includes(t.status) && t.data.imei === "111111", desc(t));
    id.tracker = t.data._id;
    check("список a = 1", (await cloud("GET", "/api/trackers", { token: T.a })).data?.length === 1);
    check("список b = 0", (await cloud("GET", "/api/trackers", { token: T.b })).data?.length === 0);
    check("b не змінює чужий трекер", (await cloud("PATCH", "/api/trackers/" + id.tracker, { token: T.b, body: { name: "x" } })).status === 404);
    const p = await cloud("PATCH", "/api/trackers/" + id.tracker, { token: T.a, body: { name: "Авто-2" } });
    check("перейменувати трекер", p.status === 200 && p.data.name === "Авто-2", desc(p));
    check("трекери без токена 401", (await cloud("GET", "/api/trackers")).status === 401);
  });

  const sockets = {};
  await step("socket.io і TCP-точки", async () => {
    sockets.anon = await sock(null);
    check("анонімний сокет відхилено", !sockets.anon.ok);
    sockets.bad = await sock("not-a-jwt");
    check("сокет із зіпсованим токеном відхилено", !sockets.bad.ok);
    for (const u of ["a", "b", "c"]) sockets[u] = await sock(T[u]);
    check("сокети a/b/c підключено", sockets.a.ok && sockets.b.ok && sockets.c.ok);
    await tcpSend("POST /track?id=111111&lat=50.0&lon=36.2&speed=10&bearing=90 HTTP/1.1");
    check("власник отримав точку (POST-формат)", await waitFor(() => sockets.a.got.location.includes("111111")));
    await wait(300);
    check("інший користувач точку не отримав", !sockets.b.got.location.includes("111111"));
    await tcpSend("*HQ,111111,V1,120000,A,5000.0000,N,03612.0000,E,10,90,261126,FFFFFBFF#");
    await waitFor(() => sockets.a.got.location.filter((x) => x === "111111").length >= 2);
    const hq = await db.collection("logs").findOne({ imei: "111111", raw: /HQ/ });
    check("HQ-формат розібрано", hq && Math.abs(hq.latitude - 50.0) < 0.01 && Math.abs(hq.longitude - 36.2) < 0.01, JSON.stringify(hq));
    const before = await db.collection("logs").countDocuments();
    await tcpSend("hello garbage");
    await wait(300);
    check("сміття по TCP ігнорується", (await db.collection("logs").countDocuments()) === before);
  });

  await step("логи", async () => {
    const l = await cloud("GET", "/api/logs?imei=111111", { token: T.a });
    check("логи власника ≥ 2", l.status === 200 && l.data.length >= 2, desc(l));
    check("логи чужого трекера 403", (await cloud("GET", "/api/logs?imei=111111", { token: T.b })).status === 403);
    const lt = await cloud("GET", "/api/logs/latest", { token: T.a });
    check("logs/latest", lt.status === 200 && JSON.stringify(lt.data).includes("111111"), desc(lt));
    const ph = await cloud("POST", "/api/logs/phone", { token: T.b, body: { latitude: 49.99, longitude: 36.23, speed: 2 } });
    check("точка з телефону 201", ph.status === 201, desc(ph));
    check("трекер телефону створено автоматично", (await cloud("GET", "/api/trackers", { token: T.b })).data?.some((t) => t.imei === "phone-" + id.b));
    check("телефон без координат 400", (await cloud("POST", "/api/logs/phone", { token: T.b, body: {} })).status === 400);
  });

  await step("геозони", async () => {
    const z = await cloud("POST", "/api/zones", { token: T.a, body: { name: "Дім", lat: 50.0, lng: 36.2, radius: 500 } });
    check("створити зону 201", z.status === 201, desc(z));
    id.zone = z.data._id;
    check("зона без полів 400", (await cloud("POST", "/api/zones", { token: T.a, body: { name: "x" } })).status === 400);
    check("зони b = 0", (await cloud("GET", "/api/zones", { token: T.b })).data?.length === 0);
    await tcpSend("POST /track?id=111111&lat=50.0005&lon=36.2005&speed=1 HTTP/1.1");
    await wait(600);
    await tcpSend("POST /track?id=111111&lat=51.0&lon=37.0&speed=1 HTTP/1.1");
    const ok = await waitFor(async () => (await db.collection("zoneevents").countDocuments({ imei: "111111" })) >= 2);
    const ev = await db.collection("zoneevents").find({ imei: "111111" }).sort({ createdAt: 1 }).toArray();
    check("геозона: вхід, потім вихід", ok && ev[0]?.event === "enter" && ev[1]?.event === "exit", JSON.stringify(ev.map((e) => e.event)));
    const zp = await cloud("PATCH", "/api/zones/" + id.zone, { token: T.a, body: { radius: 800 } });
    check("змінити зону", zp.status === 200 && zp.data.radius === 800, desc(zp));
    check("b не змінює чужу зону", (await cloud("PATCH", "/api/zones/" + id.zone, { token: T.b, body: { radius: 1 } })).status === 404);
  });

  await step("чат", async () => {
    const g = await cloud("POST", "/api/chat/messages", { token: T.a, body: { text: "загальне-1" } });
    check("загальне повідомлення 201", g.status === 201, desc(g));
    check("загальне дійшло до b і c", await waitFor(() => sockets.b.got.chat.includes("загальне-1") && sockets.c.got.chat.includes("загальне-1")));
    await cloud("POST", "/api/chat/messages", { token: T.a, body: { text: "особисте-1", recipientId: id.b } });
    check("особисте дійшло до b", await waitFor(() => sockets.b.got.chat.includes("особисте-1")));
    await wait(300);
    check("особисте НЕ дійшло до c", !sockets.c.got.chat.includes("особисте-1"));
    const un = await cloud("GET", "/api/chat/unread", { token: T.b });
    check("непрочитані b від a = 1", un.status === 200 && un.data.some((x) => String(x._id) === id.a && x.count === 1), desc(un));
    const pm = await cloud("GET", "/api/chat/messages?recipientId=" + id.a, { token: T.b });
    check("діалог b↔a", pm.status === 200 && pm.data.length === 1 && pm.data[0].text === "особисте-1", desc(pm));
    check("після читання непрочитаних 0", (await cloud("GET", "/api/chat/unread", { token: T.b })).data?.length === 0);
    const gm = await cloud("GET", "/api/chat/messages", { token: T.c });
    check("загальний чат: лише загальні", gm.status === 200 && gm.data.length === 1 && gm.data[0].text === "загальне-1", desc(gm));
    const us = await cloud("GET", "/api/chat/users?q=b@", { token: T.a });
    check("пошук користувачів", us.status === 200 && us.data.length === 1 && us.data[0].email === "b@reg.test", desc(us));
  });
  for (const s of Object.values(sockets)) s?.s?.close();

  await step("задачі", async () => {
    const c0 = await cloud("GET", "/api/tasks/categories", { token: T.a });
    check("категорії за замовчуванням (5)", c0.status === 200 && c0.data.length === 5, desc(c0));
    check("додати категорію", (await cloud("POST", "/api/tasks/categories", { token: T.a, body: { name: "тест" } })).data?.includes("тест"));
    check("дубль категорії 400", (await cloud("POST", "/api/tasks/categories", { token: T.a, body: { name: "тест" } })).status === 400);
    check("видалити категорію", !(await cloud("DELETE", "/api/tasks/categories/" + encodeURIComponent("тест"), { token: T.a })).data?.includes("тест"));
    const t = await cloud("POST", "/api/tasks", { token: T.a, body: { title: "Задача-1", category: "авто", priority: "high" } });
    check("створити задачу 201", t.status === 201 && t.data.column === "idea", desc(t));
    check("задача без назви 400", (await cloud("POST", "/api/tasks", { token: T.a, body: {} })).status === 400);
    const p = await cloud("PATCH", "/api/tasks/" + t.data._id, { token: T.a, body: { column: "done", title: "Задача-1" } });
    check("перемістити задачу", p.status === 200 && p.data.column === "done", desc(p));
    check("b не змінює чужу задачу", (await cloud("PATCH", "/api/tasks/" + t.data._id, { token: T.b, body: { title: "x" } })).status === 404);
    const cm = await cloud("POST", `/api/tasks/${t.data._id}/comments`, { token: T.a, body: { text: "коментар" } });
    check("коментар", cm.status === 200 && cm.data.comments.length === 1, desc(cm));
    const dc = await cloud("DELETE", `/api/tasks/${t.data._id}/comments/${cm.data.comments[0]._id}`, { token: T.a });
    check("видалити коментар", dc.status === 200 && dc.data.comments.length === 0, desc(dc));
    check("список задач b порожній", (await cloud("GET", "/api/tasks", { token: T.b })).data?.length === 0);
    check("видалити задачу", (await cloud("DELETE", "/api/tasks/" + t.data._id, { token: T.a })).status === 200);
    check("список задач a порожній", (await cloud("GET", "/api/tasks", { token: T.a })).data?.length === 0);
  });

  await step("синхронізація і черга telegram", async () => {
    check("sync без секрету 401", (await cloud("GET", "/api/sync")).status === 401);
    const s = await cloud("GET", "/api/sync", { headers: { "x-sync-secret": SYNC_SECRET } });
    check("sync з секретом", s.status === 200 && s.data.logs.count >= 3 && s.data.trackers.length >= 2 && s.data.users.length === 3, desc(s));
    check("sync віддає хеші паролів", s.data?.users?.every((u) => /^\$2[aby]\$/.test(u.password)));
    check("telegram/queue без секрету 401", (await cloud("POST", "/api/telegram/queue", { body: { telegramId: "1", text: "x" } })).status === 401);
    const q = await cloud("POST", "/api/telegram/queue", { headers: { "x-sync-secret": SYNC_SECRET }, body: { telegramId: "42", text: "з черги" } });
    check("telegram/queue з секретом", q.status === 200 && q.data.status === "pending", desc(q));
    check("telegram/queue GET", (await cloud("GET", "/api/telegram/queue", { token: T.a })).data?.some((m) => m.text === "з черги"));
  });

  await step("бекап", async () => {
    const r = await fetch(CLOUD + "/api/admin/backup", { headers: { Authorization: "Bearer " + T.a } });
    const j = await r.json();
    check("backup: JSON із колекціями", r.status === 200 && ["logs", "trackers", "zones", "users", "zoneevents"].every((k) => Array.isArray(j.collections?.[k])));
    check("backup: дані на місці", j.collections?.users?.length === 3 && j.collections?.zoneevents?.length >= 2);
    check("backup не-адмін 403", (await cloud("GET", "/api/admin/backup", { token: T.b })).status === 403);
  });

  await step("AI-агент (без мережі)", async () => {
    check("агент без доступу 403", (await cloud("POST", "/api/agent/chat", { token: T.c, body: { message: "hi" } })).status === 403);
    check("агент без ключа 503", (await cloud("POST", "/api/agent/chat", { token: T.a, body: { message: "hi" } })).status === 503);
  });

  // Критичні вади з рецензії 26.11 (#6–#8). Окремий користувач e — щоб на вразливій версії
  // захоплення акаунта не зачепило a/b/c, з якими працюють інші фази.
  await step("безпека: NoSQL-ін'єкція в токенах (#6)", async () => {
    const r = await cloud("POST", "/api/auth/register", { body: { email: "e@reg.test", password: "Victim-e-1" } });
    const tE = r.data?.token;
    await cloud("POST", "/api/auth/forgot-password", { body: { email: "e@reg.test" } });
    const inj = await cloud("POST", "/api/auth/reset-password", { body: { token: { $ne: null }, password: "Hacked-e-1" } });
    check("reset-password: токен-об'єкт 400", inj.status === 400, desc(inj));
    check("reset-password: пароль жертви не змінено", !(await login(CLOUD, "e@reg.test", "Hacked-e-1")) && !!(await login(CLOUD, "e@reg.test", "Victim-e-1")));
    const inj2 = await cloud("POST", "/api/auth/reset-password", { body: { token: { $gt: "" }, password: "Hacked-e-2" } });
    check("reset-password: $gt 400", inj2.status === 400, desc(inj2));
    const ve = await cloud("GET", "/api/auth/verify-email?token[$ne]=x");
    check("verify-email: ?token[$ne]= 400", ve.status === 400, desc(ve));
    check("verify-email: e не підтверджено", (await cloud("GET", "/api/auth/me", { token: tE })).data?.emailVerified !== true);
    check("forgot-password: email-об'єкт 400", (await cloud("POST", "/api/auth/forgot-password", { body: { email: { $ne: null } } })).status === 400);
    check("login: email-об'єкт 400", (await cloud("POST", "/api/auth/login", { body: { email: { $ne: null }, password: "x" } })).status === 400);
    // справжній токен із бази досі працює
    await cloud("POST", "/api/auth/forgot-password", { body: { email: "e@reg.test" } });
    const u = await db.collection("users").findOne({ email: "e@reg.test" });
    check("reset-password рядковим токеном 200", (await cloud("POST", "/api/auth/reset-password", { body: { token: u.resetToken, password: "Victim-e-2" } })).status === 200);
    check("verify-email рядковим токеном 200", (await cloud("GET", "/api/auth/verify-email?token=" + u.verificationToken)).status === 200);
  });

  await step("безпека: логи лише свої (#7)", async () => {
    const all = await cloud("GET", "/api/logs", { token: T.b });
    check("logs без imei: 200", all.status === 200, desc(all));
    check("logs без imei: немає чужих точок", Array.isArray(all.data) && !all.data.some((l) => l.imei === "111111"), desc(all));
    check("logs без imei: свої є", Array.isArray(all.data) && all.data.some((l) => l.imei === "phone-" + id.b), desc(all));
    const own = await cloud("GET", "/api/logs", { token: T.a });
    check("logs без imei: власник бачить свої", Array.isArray(own.data) && own.data.some((l) => l.imei === "111111"), desc(own));
    const inj = await cloud("GET", "/api/logs?imei[$ne]=x", { token: T.b });
    check("logs ?imei[$ne]=: немає чужих точок", inj.status === 400 || (Array.isArray(inj.data) && !inj.data.some((l) => l.imei === "111111")), desc(inj));
  });

  await step("безпека: черга telegram лише admin (#8)", async () => {
    const q = await cloud("GET", "/api/telegram/queue", { token: T.b });
    check("telegram/queue GET не-адмін 403", q.status === 403, desc(q));
    check("telegram/queue GET без токена 401", (await cloud("GET", "/api/telegram/queue")).status === 401);
  });

  fs.writeFileSync(`${OUT}/full-users.json`, JSON.stringify({ a: P.a, b: P.b, c: P.c }));
}

// ─────────────────────── сценарій оновлення: крок 1 ───────────────────────
async function seed() {
  const s = { users: {} };
  await step("seed: користувачі", async () => {
    for (const [u, pw] of [["old1", "OldPass-1"], ["old2", "OldPass-2"]]) {
      const r = await cloud("POST", "/api/auth/register", { body: { email: `${u}@reg.test`, password: pw } });
      check(`seed: register ${u}`, r.status === 201, desc(r));
      s.users[u] = { email: `${u}@reg.test`, password: pw, token: r.data.token };
    }
    await db.collection("users").updateOne({ email: "old1@reg.test" }, { $set: { role: "admin", emailVerified: true } });
    s.users.old1.token = await login(CLOUD, "old1@reg.test", "OldPass-1");
  });
  await step("seed: дані", async () => {
    const T = s.users.old1.token;
    const t = await cloud("POST", "/api/trackers", { token: T, body: { name: "Старий", imei: "999999" } });
    check("seed: трекер", [200, 201].includes(t.status), desc(t));
    await cloud("POST", "/api/zones", { token: T, body: { name: "Старий дім", lat: 50.0, lng: 36.2, radius: 500 } });
    await tcpSend("POST /track?id=999999&lat=50.0&lon=36.2&speed=1 HTTP/1.1");
    await wait(400);
    await tcpSend("POST /track?id=999999&lat=51.0&lon=37.0&speed=1 HTTP/1.1");
    await wait(400);
    await cloud("POST", "/api/tasks", { token: T, body: { title: "Стара задача" } });
    await cloud("POST", "/api/chat/messages", { token: T, body: { text: "старе повідомлення" } });
    const counts = {};
    for (const c of ["users", "trackers", "zones", "logs", "tasks", "chatmessages", "zoneevents"]) counts[c] = await db.collection(c).countDocuments();
    s.counts = counts;
    check("seed: логи 2", counts.logs === 2, JSON.stringify(counts));
  });
  fs.writeFileSync(`${OUT}/seed-data.json`, JSON.stringify(s, null, 1));
}

// ─────────────────────── сценарій оновлення: крок 2 ───────────────────────
async function verify() {
  const s = JSON.parse(fs.readFileSync(`${OUT}/seed-data.json`, "utf8"));
  await step("verify: старі паролі", async () => {
    for (const [u, info] of Object.entries(s.users)) {
      const tok = await login(CLOUD, info.email, info.password);
      check(`verify: вхід ${u} паролем, захешованим старою версією`, !!tok);
      info.newToken = tok;
    }
    check("verify: неправильний пароль 401", (await cloud("POST", "/api/auth/login", { body: { email: "old1@reg.test", password: "wrong-pass" } })).status === 401);
    check("verify: старий JWT дійсний", (await cloud("GET", "/api/auth/me", { token: s.users.old2.token })).status === 200);
  });
  await step("verify: дані збереглися", async () => {
    const counts = {};
    for (const c of Object.keys(s.counts)) counts[c] = await db.collection(c).countDocuments();
    check("verify: кількість документів та сама", JSON.stringify(counts) === JSON.stringify(s.counts), `${JSON.stringify(s.counts)} → ${JSON.stringify(counts)}`);
    const T = s.users.old1.newToken;
    check("verify: трекер", (await cloud("GET", "/api/trackers", { token: T })).data?.[0]?.imei === "999999");
    check("verify: логи", (await cloud("GET", "/api/logs?imei=999999", { token: T })).data?.length === 2);
    check("verify: зона", (await cloud("GET", "/api/zones", { token: T })).data?.[0]?.name === "Старий дім");
    check("verify: задача", (await cloud("GET", "/api/tasks", { token: T })).data?.[0]?.title === "Стара задача");
    check("verify: чат", (await cloud("GET", "/api/chat/messages", { token: T })).data?.[0]?.text === "старе повідомлення");
    const ev = await db.collection("zoneevents").find({ imei: "999999" }).sort({ createdAt: 1 }).toArray();
    check("verify: події геозон", ev.map((e) => e.event).join(",") === "enter,exit", ev.map((e) => e.event).join(","));
  });
  await step("verify: нова версія пише нормально", async () => {
    const r = await cloud("POST", "/api/auth/change-password", { token: s.users.old2.newToken, body: { currentPassword: "OldPass-2", newPassword: "NewPass-2" } });
    check("verify: зміна пароля старого користувача", r.status === 200, desc(r));
    check("verify: вхід новим паролем", !!(await login(CLOUD, "old2@reg.test", "NewPass-2")));
    s.users.old2.password = "NewPass-2";
    const n = await cloud("POST", "/api/auth/register", { body: { email: "new1@reg.test", password: "NewUser-1" } });
    check("verify: реєстрація на новій версії", n.status === 201, desc(n));
    const so = await sock(s.users.old1.newToken);
    await tcpSend("POST /track?id=999999&lat=50.0&lon=36.2&speed=1 HTTP/1.1");
    check("verify: точка доходить власнику", await waitFor(() => so.got.location.includes("999999")));
    so.s?.close();
  });
  fs.writeFileSync(`${OUT}/seed-data.json`, JSON.stringify(s, null, 1));
}

// ─────────────────────── local після синхронізації ───────────────────────
async function localPhase() {
  const usersFile = fs.existsSync(`${OUT}/seed-data.json`) ? "seed" : "full";
  const creds = usersFile === "seed"
    ? Object.values(JSON.parse(fs.readFileSync(`${OUT}/seed-data.json`, "utf8")).users).map((u) => [u.email, u.password])
    : Object.entries(JSON.parse(fs.readFileSync(`${OUT}/full-users.json`, "utf8"))).map(([u, p]) => [`${u}@reg.test`, p]);
  await step("local", async () => {
    check("local: status 200", (await local("GET", "/api/status")).status === 200);
    check("local: захищене без токена 401", (await local("GET", "/api/trackers")).status === 401);
    const ok = await waitFor(async () => (await local("POST", "/api/auth/login", { body: { email: creds[0][0], password: creds[0][1] } })).status === 200, 15000);
    check("local: вхід хмарним паролем після синхронізації (bcryptjs ↔ bcrypt)", ok);
    for (const [email, pw] of creds.slice(1)) {
      check(`local: вхід ${email}`, (await local("POST", "/api/auth/login", { body: { email, password: pw } })).status === 200);
    }
    check("local: неправильний пароль 401", (await local("POST", "/api/auth/login", { body: { email: creds[0][0], password: "wrong-pass" } })).status === 401);
    const T = (await local("POST", "/api/auth/login", { body: { email: creds[0][0], password: creds[0][1] } })).data.token;
    const tr = await local("GET", "/api/trackers", { token: T });
    check("local: трекери синхронізовано", tr.status === 200 && tr.data.length >= 1, desc(tr));
    const imei = tr.data?.[0]?.imei;
    const lg = await local("GET", "/api/logs?imei=" + imei, { token: T });
    check("local: логи синхронізовано", lg.status === 200 && lg.data.length >= 1, desc(lg));
    check("local: logs/latest", (await local("GET", "/api/logs/latest", { token: T })).status === 200);
    check("local: зони синхронізовано", (await local("GET", "/api/zones", { token: T })).data?.length >= 1);
    check("local: користувачі", (await local("GET", "/api/users", { token: T })).data?.length >= 2);
    check("local: me", (await local("GET", "/api/auth/me", { token: T })).data?.email === creds[0][0]);
    const lt = await local("POST", "/api/tasks", { token: T, body: { title: "Локальна задача" } });
    check("local: задачі", [200, 201].includes(lt.status), desc(lt));
    const T2 = (await local("POST", "/api/auth/login", { body: { email: creds[1][0], password: creds[1][1] } })).data.token;
    const id1 = (await local("GET", "/api/auth/me", { token: T })).data?._id;
    const id2 = (await local("GET", "/api/auth/me", { token: T2 })).data?._id;
    await local("POST", "/api/chat/messages", { token: T, body: { text: "локальне особисте", recipientId: id2 } });
    const un = await local("GET", "/api/chat/unread", { token: T2 });
    check("local: непрочитані = 1", un.status === 200 && un.data.some((x) => String(x._id) === String(id1) && x.count === 1), desc(un));
  });
}

async function waitService(base, path, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(base + path)).status === 200) return; } catch {}
    await wait(500);
  }
  throw new Error(`служба ${base} не піднялась за ${ms / 1000} с`);
}

(async () => {
  try {
    await waitService(CLOUD, "/api/health");
    if (phase === "local") await waitService(LOCAL, "/api/status");
    await openDb();
    if (phase === "full") await full();
    else if (phase === "seed") await seed();
    else if (phase === "verify") await verify();
    else if (phase === "local") await localPhase();
    else throw new Error("невідома фаза " + phase);
  } catch (e) {
    check("фаза " + phase, false, e?.stack || e);
  } finally {
    await mongo?.close().catch(() => {});
  }
  fs.writeFileSync(`${OUT}/${phase}.json`, JSON.stringify(results, null, 1));
  const bad = results.filter((r) => !r.ok && !r.known);
  const known = results.filter((r) => r.known);
  for (const r of results) console.log(`${r.ok ? "✓" : r.known ? "⚠" : "✗"} ${r.name}${r.ok ? "" : "  — " + (r.known ? "відома вада: " + r.known : r.detail)}`);
  console.log(`\n${phase}: ${results.filter((r) => r.ok).length}/${results.length} пройдено` +
    (known.length ? `, відомих вад ${known.length}` : "") + (bad.length ? `, ПРОВАЛІВ ${bad.length}` : ""));
  process.exit(bad.length ? 1 : 0);
})();
