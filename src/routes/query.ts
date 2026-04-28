import type { FastifyPluginAsync } from "fastify";
import type { QueryRequest, QueryResponse } from "../types.js";
import { store } from "../lib/vectorStore.js";
import { embed, generateAnswer } from "../lib/openai.js";

const queryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: QueryRequest }>("/query", async (request, reply) => {
    const start = performance.now();

    const { question, top_k = 3, category } = request.body ?? {};

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return reply.status(400).send({ error: "A non-empty 'question' field is required." });
    }

    if (!store.isPopulated) {
      return reply
        .status(503)
        .send({ error: "Vector store is empty. Call POST /ingest first." });
    }

    const queryEmbedding = await embed(question);
    const results = store.search(queryEmbedding, top_k, category);

    if (results.length === 0) {
      const latency_ms = Math.round(performance.now() - start);
      return {
        answer: "I couldn't find any relevant information to answer your question.",
        sources: [],
        latency_ms,
      } satisfies QueryResponse;
    }

    const answer = await generateAnswer(question, results);
    const latency_ms = Math.round(performance.now() - start);
    const sources = [...new Set(results.map((r) => r.chunk.id))];

    return { answer, sources, latency_ms } satisfies QueryResponse;
  });
};

export default queryRoutes;
