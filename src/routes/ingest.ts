import type { FastifyPluginAsync } from "fastify";
import type { FaqEntry } from "../types.js";
import { store } from "../lib/vectorStore.js";
import { ingestFaqs } from "../lib/chunker.js";

const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: FaqEntry[] }>("/ingest", async (request, reply) => {
    const faqs = request.body;

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return reply.status(400).send({ error: "Request body must be a non-empty array of FAQ entries." });
    }

    const count = await ingestFaqs(faqs);

    return {
      status: "ok",
      documents_ingested: count,
      total_in_store: store.size,
    };
  });
};

export default ingestRoutes;
