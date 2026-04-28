export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface VectorChunk {
  id: string;           // FAQ-001, FAQ-002, etc.
  category: string;
  text: string;         // The concatenated question + answer
  embedding: number[];
}

export interface QueryRequest {
  question: string;
  top_k?: number;
  category?: string;    // Optional metadata filter
}

export interface QueryResponse {
  answer: string;
  sources: string[];
  latency_ms: number;
}

export interface SearchResult {
  chunk: VectorChunk;
  score: number;
}