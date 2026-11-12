import health from "../api/health.js";
import clientError from "../api/client-error.js";
import operations from "../api/operations.js";
import opsStatus from "../api/ops-status.js";
import http from "node:http";
import { createClient } from "@supabase/supabase-js";
import { createGenerationHandler } from "../server/handler.js";
for (const name of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
]) {
  if (!process.env[name])
    throw new Error(`Tetapan ${name} diperlukan untuk API pembangunan.`);
}
const handler = createGenerationHandler({ createClient });
const server = http.createServer(async (req, res) => {
  res.status = (status) => {
    res.statusCode = status;
    return res;
  };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
    return res;
  };
  const routes = {
    "/api/generate": handler,
    "/api/health": health,
    "/api/client-error": clientError,
    "/api/operations": operations,
    "/api/ops-status": opsStatus,
  };
  const selected = routes[new URL(req.url, "http://localhost").pathname];
  if (!selected) {
    res.status(404).json({ error: "Endpoint tidak ditemukan." });
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 60000) {
      res.status(413).json({ error: "Permintaan terlalu besar." });
      return;
    }
  }
  req.body = body;
  await selected(req, res);
});
server.requestTimeout = 60000;
server.listen(3001, "127.0.0.1", () =>
  console.log("API pembangunan GuruKit tersedia pada port 3001."),
);
