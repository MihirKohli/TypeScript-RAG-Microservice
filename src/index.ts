import Fastify from "fastify";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

import type { FaqEntry, QueryRequest, QueryResponse } from "./types.js";
import { store } from "./lib/vectorStore.js";
import { ingestFaqs } from "./lib/ingest.js";
import { embed } from "./llmCall.js";
import { generateAnswer } from "./llmCall.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// ─── POST /ingest ─────────────────────────────────────────────────────────────
app.post("/ingest", async (_request, reply) => {
  const faqPath = path.join(__dirname, "..", "data", "beem_faqs.json");

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

// ─── POST /query ──────────────────────────────────────────────────────────────
app.post<{ Body: QueryRequest }>("/query", async (request, reply) => {
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

  // 1. Embed the user query
  const queryEmbedding = await embed(question);

  // 2. Retrieve top-k chunks (with optional category filter)
  const results = store.search(queryEmbedding, top_k, category);

  if (results.length === 0) {
    const latency_ms = Math.round(performance.now() - start);
    return {
      answer: "I couldn't find any relevant information to answer your question.",
      sources: [],
      latency_ms,
    } satisfies QueryResponse;
  }

  // 3. Generate grounded answer via LLM
  const answer = await generateAnswer(question, results);

  const latency_ms = Math.round(performance.now() - start);

  const sources = [...new Set(results.map((r) => r.chunk.id))];

  return { answer, sources, latency_ms } satisfies QueryResponse;
});

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get("/health", async () => {
  return {
    status: "ok",
    documents_in_store: store.size,
    uptime_seconds: Math.round(process.uptime()),
  };
});

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