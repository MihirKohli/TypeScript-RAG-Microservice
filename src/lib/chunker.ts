import type { FaqEntry } from "../types.js";
import { embedBatch } from "./openai.js";
import { store } from "./vectorStore.js";

// Chunking strategy
// I have embedded as single chunk of "Q: {question}\nA: {answer}"
// chunking them together will create better relevancy and better vectors
// Because faq answers and questions are short
// i haven't split them because chunking them further will destroy semantic
// coherence and reduces accuracy
// category is stored as metadata optional for filter
// not stored as embedding becauses it a repeated value
// will create a alot of duplicates and decrease semantic accuracy

const CHUNK_SIZE = 1024;
const CHUNK_OVERLAP = 20;
const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

/**
 * recursively splits text trying separators from coarsest to finest
 * falls back to next separator if splits still exceed chunkSize
 * @param text - text to split
 * @param separators - ordered list of separators to try (paragraph → line → sentence → word → char)
 * @param chunkSize - max characters per chunk, defaults to 1024
 * @param overlap - characters to carry over into the next chunk for context, defaults to 20
 * @returns array of text chunks
 */
export function recursiveChunk(
  text: string,
  separators: string[] = SEPARATORS,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): string[] {
  if (text.length <= chunkSize) return [text];

  const [sep, ...nextSeparators] = separators;

  // re-attach separator so each split is self-contained
  const rawSplits = sep === "" ? [...text] : text.split(sep);
  const splits = rawSplits
    .map((s, i) => (sep !== "" && i < rawSplits.length - 1 ? s + sep : s))
    .filter((s) => s.trim().length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const split of splits) {
    if (split.length > chunkSize) {
      // split is itself too large, flush current and recurse with next separator
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      const sub =
        nextSeparators.length > 0
          ? recursiveChunk(split, nextSeparators, chunkSize, overlap)
          : [split];
      chunks.push(...sub);
    } else if (current.length + split.length > chunkSize) {
      // adding this split would exceed chunk size, flush and start next with overlap
      chunks.push(current);
      current = current.slice(-overlap) + split;
    } else {
      current += split;
    }
  }

  if (current.trim().length > 0) chunks.push(current);

  return chunks;
}

/**
 * combines question and answer into a single text block for chunking
 * @param faq - single FaqEntry
 * @returns formatted string "Q: ...\nA: ..."
 */
function chunkFaq(faq: FaqEntry): string {
  return `Q: ${faq.question}\nA: ${faq.answer}`;
}

const BATCH_SIZE = 100; // openai allows max 2048 per request, 100 is a safe limit

/**
 * chunks and embeds all faqs then upserts them into the vector store
 * one faq may produce multiple chunks if its text exceeds CHUNK_SIZE
 * @param faqs - array of FaqEntry from the request body
 * @returns total number of chunks ingested
 */
export async function ingestFaqs(faqs: FaqEntry[]): Promise<number> {
  // build all chunks first — short faqs stay as one, long ones get split
  const allChunks: { id: string; category: string; text: string }[] = [];

  for (const faq of faqs) {
    const parts = recursiveChunk(chunkFaq(faq));
    parts.forEach((text, i) => {
      allChunks.push({
        id: parts.length > 1 ? `${faq.id}-${i}` : faq.id,
        category: faq.category,
        text,
      });
    });
  }

  // add batching process if dataset is large then divide data into batches
  // and ingest in part otherwise it will throw an error over large dataset
  for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
    const batch = allChunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((c) => c.text));

    for (let j = 0; j < batch.length; j++) {
      store.upsert({
        id: batch[j].id,
        category: batch[j].category,
        text: batch[j].text,
        embedding: embeddings[j],
      });
    }
  }

  return allChunks.length;
}
