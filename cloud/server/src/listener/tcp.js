const net = require("net");
const Log = require("../models/Log");
const Tracker = require("../models/Tracker");
const { checkZones } = require("../services/geofence");

const EARTH_RADIUS = 6372795;

function calculateDistance(latA, lonA, latB, lonB) {
  const lat1 = (latA * Math.PI) / 180;
  const lat2 = (latB * Math.PI) / 180;
  const lon1 = (lonA * Math.PI) / 180;
  const lon2 = (lonB * Math.PI) / 180;
  const dLon = lon2 - lon1;
  const y = Math.sqrt(
    Math.pow(Math.cos(lat2) * Math.sin(dLon), 2) +
    Math.pow(Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon), 2)
  );
  const x = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return Math.atan2(y, x) * EARTH_RADIUS;
}

// Convert DDMM.MMMM → decimal degrees
function toDecimal(raw) {
  const parts = (raw + "").split(".");
  const decimal = ("000" + Math.floor(Number(parts[1]) / 60)).slice(-4);
  return Number(parts[0] + "." + decimal);
}

// Parse HQ protocol: *HQ,IMEI,V1,HHMMSS,A,DDMM.MMMM,N,DDDMM.MMMM,E,speed,dir,DDMMYY,...#
function parseHQ(message) {
  const parts = message.split(",");
  if (parts[2] !== "V1") return null;
  const dateStr = parts[11] || "";
  const timeStr = parts[3] || "";
  return {
    imei: parts[1],
    deviceTime: new Date(
      "20" + dateStr.slice(4, 6),
      Number(dateStr.slice(2, 4)) - 1,
      dateStr.slice(0, 2),
      timeStr.slice(0, 2),
      timeStr.slice(2, 4),
      timeStr.slice(4, 6)
    ),
    latitude: toDecimal((Number((parts[6] === "N" ? "" : "-") + parts[5]) / 100).toFixed(6)),
    longitude: toDecimal((Number((parts[8] === "E" ? "" : "-") + parts[7]) / 100).toFixed(6)),
    speed: Number(parts[9]) * 1.60934,
    direction: Number(parts[10]),
    raw: message,
  };
}

// Parse POST format: POST /track?id=IMEI&lat=...&lon=...&speed=...
function parsePost(message) {
  const parts = message.split("?");
  if (parts[0] !== "POST /track") return null;
  const params = Object.fromEntries(
    parts[1].split(" ")[0].split("&").map((p) => p.split("="))
  );
  return {
    imei: params.id,
    latitude: Number(params.lat),
    longitude: Number(params.lon),
    speed: Number(params.speed) || 0,
    direction: Number(params.bearing) || 0,
    deviceTime: params.timestamp ? new Date(Number(params.timestamp) * 1000) : new Date(),
    raw: message,
  };
}

function parseMessage(message) {
  if (message.includes(",V1,")) return parseHQ(message);
  if (message.startsWith("POST /track")) return parsePost(message);
  return null;
}

module.exports = function startTcpListener({ port, io }) {
  const server = net.createServer((socket) => {
    socket.on("data", async (data) => {
      const message = data.toString("utf8").trim();
      console.log("TCP:", message);

      const point = parseMessage(message);
      if (!point || !point.imei) return;

      try {
        const log = await Log.create(point);
        // Точку бачить лише власник трекера (home-hub #1), а не всі підключені.
        const tracker = await Tracker.findOne({ imei: point.imei }, { userId: 1 }).lean();
        if (tracker?.userId) io.to(`user:${tracker.userId}`).emit("location", log);
        checkZones(log); // geofence перевірка (non-blocking)
        console.log(`Saved log for IMEI ${point.imei}`);
      } catch (err) {
        console.error("Error saving log:", err.message);
      }
    });

    socket.on("error", (err) => {
      console.error("TCP socket error:", err.message);
    });

    socket.pipe(socket);
  });

  server.listen(port, () => {
    console.log(`TCP listener running on port ${port}`);
  });
};
