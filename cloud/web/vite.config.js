import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  const isLocal = process.env.VITE_MODE === "local";
  const apiPort = isLocal ? 3002 : 3001;
  return {
    plugins: [react()],
    server: {
      port: isLocal ? 5174 : 5173,
      proxy: {
        "/api": `http://localhost:${apiPort}`,
        "/socket.io": {
          target: `http://localhost:${apiPort}`,
          ws: true,
        },
      },
    },
  };
});
