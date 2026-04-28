import type { FaqEntry } from "../types.js";
import { embedBatch } from "./openai.js";
import { store } from "./vectorStore.js";

/**
 * Chunking strategy:
 *
 * Each FAQ is embedded as a single chunk: "Q: {question}\nA: {answer}"
 *
 * Rationale:
 * - FAQ answers are short (50-120 words each). Splitting them would
 *   destroy semantic coherence with no retrieval benefit.
 * - Prefixing with the question improves retrieval: user queries are
 *   phrased as questions, so embedding the original question alongside
 *   the answer gives the vector a dual semantic signal — it matches
 *   both question-to-question similarity AND question-to-answer relevance.
 * - Category is stored as metadata for optional pre-retrieval filtering,
 *   NOT embedded into the text. Mixing category labels into the embedding
 *   would dilute the semantic signal for short texts like these.
 */
function chunkFaq(faq: FaqEntry): string {
  return `Q: ${faq.question}\nA: ${faq.answer}`;
}

/**
 * Ingest the full FAQ dataset into the vector store.
 * Idempotent: upserting by FAQ ID means repeated calls overwrite, never duplicate.
 */
export async function ingestFaqs(faqs: FaqEntry[]): Promise<number> {
  const texts = faqs.map(chunkFaq);

  // Single batched embedding call — 20 FAQs in one round-trip
  const embeddings = await embedBatch(texts);

  for (let i = 0; i < faqs.length; i++) {
    store.upsert({
      id: faqs[i].id,
      category: faqs[i].category,
      text: texts[i],
      embedding: embeddings[i],
    });
  }

  return faqs.length;
}
