/** Raw FAQ entry from beem_faqs.json */
export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
}

/** A chunk stored in the vector store */
export interface VectorChunk {
  id: string;           // FAQ-001, FAQ-002, etc.
  category: string;
  text: string;         // The concatenated question + answer
  embedding: number[];
}

/** POST /query request body */
export interface QueryRequest {
  question: string;
  top_k?: number;
  category?: string;    // Optional metadata filter
}

/** POST /query response body */
export interface QueryResponse {
  answer: string;
  sources: string[];
  latency_ms: number;
}

/** A scored search result from the vector store */
export interface SearchResult {
  chunk: VectorChunk;
  score: number;
}