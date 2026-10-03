import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";

function toursPlugin(): Plugin {
  return {
    name: "tours-server",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url?.split("?")[0] || "";
        if (rawUrl.startsWith("/tours") || rawUrl.startsWith("/.tours/learning")) {
          let sub = rawUrl.replace(/^\/tours/, "").replace(/^\/\.tours\/learning/, "");
          if (!sub || sub === "/") sub = "/index.html";
          const filePath = path.resolve(__dirname, "../.tours/learning", "." + sub);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const mimes: Record<string, string> = {
              ".html": "text/html; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".js": "application/javascript; charset=utf-8",
              ".mjs": "application/javascript; charset=utf-8",
              ".json": "application/json; charset=utf-8",
              ".svg": "image/svg+xml",
              ".png": "image/png",
            };
            res.setHeader("Content-Type", mimes[ext] || "text/plain");
            return fs.createReadStream(filePath).pipe(res);
          }
        }
        next();
      });
    },
    async closeBundle() {
      const src = path.resolve(__dirname, "../.tours/learning");
      const dest = path.resolve(__dirname, "dist/tours");
      if (fs.existsSync(src)) {
        await fs.promises.cp(src, dest, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), toursPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
  },
});

