require("dotenv").config();
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const compression = require("compression");
const { Server } = require("socket.io");

const connectMongo = require("./config/mongo");
const startTcpListener = require("./listener/tcp");
const telegram = require("./services/telegram");

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.HTTP_PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Socket.io (real-time)
const io = new Server(httpServer, {
  cors: { origin: "*", credentials: false },
});
app.set("io", io);

const jwt = require("jsonwebtoken");
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // дозволяємо анонімне підключення для сумісності
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {}
  next();
});
io.on("connection", (socket) => {
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`);
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(express.json());

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = [FRONTEND_URL, "http://localhost:5173"];
  if (!origin) {
    // Mobile app (no origin header)
    res.header("Access-Control-Allow-Origin", "*");
  } else if (allowed.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "authorization, content-type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/trackers", require("./routes/trackers"));
app.use("/api/logs", require("./routes/logs"));
app.use("/api/zones", require("./routes/zones"));
app.use("/api/sync", require("./routes/sync"));
app.use("/api/telegram", require("./routes/telegram"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/chat",  require("./routes/chat"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Version
const VERSION = `cloud@${process.env.GIT_COMMIT || "unknown"}`;
app.get("/api/version", (req, res) => {
  res.json({ version: VERSION });
});

// Start
connectMongo().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`HTTP server running on port ${PORT}`);
  });
  startTcpListener({ port: process.env.TCP_PORT || 8090, io });
  telegram.init();
});
