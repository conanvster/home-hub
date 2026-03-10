const Zone = require("../models/Zone");
const ZoneState = require("../models/ZoneState");
const ZoneEvent = require("../models/ZoneEvent");
const Tracker = require("../models/Tracker");
const User = require("../models/User");
const { queueMsg, mapsLink } = require("./telegram");

async function sendPushNotification(token, { title, body, data }) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
  });
}

// Haversine — відстань між двома точками в метрах
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6372795;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkZones(log) {
  try {
    const tracker = await Tracker.findOne({ imei: log.imei });
    if (!tracker) return;

    const zones = await Zone.find({ userId: tracker.userId });
    if (!zones.length) return;

    const user = await User.findById(tracker.userId);

    for (const zone of zones) {
      const dist = distanceMeters(log.latitude, log.longitude, zone.lat, zone.lng);
      const isNowInside = dist <= zone.radius;

      // Отримати попередній стан (upsert)
      const prevState = await ZoneState.findOne({ imei: log.imei, zoneId: zone._id });
      const wasInside = prevState ? prevState.isInside : false;

      if (isNowInside === wasInside) {
        // Стан не змінився — тільки оновлюємо час
        await ZoneState.updateOne(
          { imei: log.imei, zoneId: zone._id },
          { $set: { isInside: isNowInside, updatedAt: new Date(), userId: tracker.userId } },
          { upsert: true }
        );
        continue;
      }

      // Стан змінився — зберігаємо новий стан і подію
      await ZoneState.updateOne(
        { imei: log.imei, zoneId: zone._id },
        { $set: { isInside: isNowInside, updatedAt: new Date(), userId: tracker.userId } },
        { upsert: true }
      );

      const event = isNowInside ? "enter" : "exit";
      await ZoneEvent.create({
        imei: log.imei,
        zoneId: zone._id,
        zoneName: zone.name,
        userId: tracker.userId,
        trackerName: tracker.name,
        event,
        lat: log.latitude,
        lng: log.longitude,
      });

      const emoji = isNowInside ? "🟢" : "🔴";
      const action = isNowInside ? "в'їхав у зону" : "виїхав із зону";
      const link = mapsLink(log.latitude, log.longitude);

      // Telegram повідомлення
      if (user?.telegramId) {
        queueMsg(user.telegramId,
          `${emoji} *${tracker.name}* ${action} *${zone.name}*\n` +
          `[📍 Google Maps](${link})`,
          { type: "geofence", imei: tracker.imei, zone: zone.name, event }
        );
      }

      // Expo Push нотифікація
      if (user?.expoPushToken) {
        sendPushNotification(user.expoPushToken, {
          title: `${emoji} ${tracker.name}`,
          body: `${action} "${zone.name}"`,
          data: { type: "geofence", imei: tracker.imei, zone: zone.name, event },
        }).catch((e) => console.error("[Push] error:", e.message));
      }
    }
  } catch (err) {
    console.error("[Geofence] error:", err.message);
  }
}

module.exports = { checkZones };
