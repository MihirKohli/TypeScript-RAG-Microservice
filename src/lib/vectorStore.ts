import type { VectorChunk, SearchResult } from "../types.js";

// Cosine similarity between two vectors.
// text-embedding-3-small outputs are already L2-normalized,
// so dot product === cosine similarity. We still use the full
// formula for correctness with any embedding model.

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

// Dead-simple in-memory vector store.
// Stores chunks keyed by ID for idempotent upserts,
// searches via brute-force cosine similarity.
 
class VectorStore {
  private chunks: Map<string, VectorChunk> = new Map();

  // Upsert a chunk — same ID overwrites, guaranteeing idempotency. 
  upsert(chunk: VectorChunk): void {
    this.chunks.set(chunk.id, chunk);
  }

  //  Number of stored chunks
  get size(): number {
    return this.chunks.size;
  }

  //  Whether the store has been populated.
  get isPopulated(): boolean {
    return this.chunks.size > 0;
  }

  //  Search for the top-k most similar chunks to a query embedding.
  //  Optionally filter by category before ranking.
   
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

//  Singleton store instance — lives for the process lifetime. 
export const store = new VectorStore();