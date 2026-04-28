import type { FastifyPluginAsync } from "fastify";
import { store } from "../lib/vectorStore.js";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      status: "ok",
      documents_in_store: store.size,
      uptime_seconds: Math.round(process.uptime()),
    };
  });
};

export default healthRoutes;
