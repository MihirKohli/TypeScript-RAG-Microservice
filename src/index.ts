import Fastify from "fastify";
import "dotenv/config";

import ingestRoutes from "./routes/ingest.js";
import queryRoutes from "./routes/query.js";
import healthRoutes from "./routes/health.js";

const app = Fastify({ logger: true });

// ─── Request logging hook ─────────────────────────────────────────────────────
app.addHook("onResponse", (request, reply, done) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      latency_ms: Math.round(reply.elapsedTime),
    },
    "request completed"
  );
  done();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.register(ingestRoutes);
app.register(queryRoutes);
app.register(healthRoutes);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "4500", 10);

async function start() {
  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();