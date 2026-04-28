import Fastify from "fastify";
import "dotenv/config";

import ingestRoutes from "./routes/ingest.js";
import queryRoutes from "./routes/query.js";
import healthRoutes from "./routes/health.js";

const app = Fastify({ logger: true });

// user request logger hook
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

// register route in index file
app.register(ingestRoutes);
app.register(queryRoutes);
app.register(healthRoutes);

// if port number not found then default it with 4500 
// convert it to integer this is a error handling 
// generally from env port number are loaded in string form
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