import type { VectorChunk, SearchResult } from "../types.js";

/**
 * calculates cosine similarity between two vectors
 * using full formula so it works with any embedding model, not just openai
 * @param a - first embedding vector
 * @param b - second embedding vector
 * @returns similarity score between 0 and 1
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// in-memory store using a Map keyed by faq id
// brute force cosine search, no external db needed

class VectorStore {
  private chunks: Map<string, VectorChunk> = new Map();

  /**
   * overwrite if same id so calling ingest twice doesn't duplicate entries
   * @param chunk - VectorChunk with id, category, text, and embedding
   */
  upsert(chunk: VectorChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  // total chunks currently in store
  get size(): number {
    return this.chunks.size;
  }

  // true if at least one chunk has been ingested
  get isPopulated(): boolean {
    return this.chunks.size > 0;
  }

  /**
   * find top k chunks most similar to query, category filter is optional
   * @param queryEmbedding - embedding vector of the user question
   * @param topK - number of results to return
   * @param category - optional category to filter chunks before ranking
   * @returns array of SearchResult sorted by score descending
   */
  search(
    queryEmbedding: number[],
    topK: number,
    category?: string
  ): SearchResult[] {
    const candidates = category
      ? [...this.chunks.values()].filter((c) => c.category === category)
      : [...this.chunks.values()];

    const scored: SearchResult[] = candidates.map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}

// single instance shared across the whole app
export const store = new VectorStore();