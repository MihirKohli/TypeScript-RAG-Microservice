import type { FastifyPluginAsync } from "fastify";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { FaqEntry } from "../types.js";
import { store } from "../lib/vectorStore.js";
import { ingestFaqs } from "../lib/ingest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/ingest", async (_request, reply) => {
    const faqPath = path.join(__dirname, "..", "..", "data", "beem_faqs.json");

    let faqs: FaqEntry[];
    try {
      const raw = await readFile(faqPath, "utf-8");
      faqs = JSON.parse(raw) as FaqEntry[];
    } catch {
      return reply.status(500).send({ error: "Failed to read FAQ data file." });
    }

    if (!Array.isArray(faqs) || faqs.length === 0) {
      return reply.status(400).send({ error: "FAQ data is empty or malformed." });
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
