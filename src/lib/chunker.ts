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


/**
 * combines question and answer into a single chunk for embedding
 * @param faq - single FaqEntry
 * @returns formatted string "Q: ...\nA: ..."
 */
function chunkFaq(faq: FaqEntry): string {
  return `Q: ${faq.question}\nA: ${faq.answer}`;
}

const BATCH_SIZE = 100; // openai allows max 2048 per request, 100 is a safe limit

/**
 * chunks and embeds all faqs then upserts them into the vector store
 * @param faqs - array of FaqEntry from the request body
 * @returns number of documents ingested
 */
export async function ingestFaqs(faqs: FaqEntry[]): Promise<number> {
  const texts = faqs.map(chunkFaq);

  // add batching process if dataset is large then divide data into batches
  // and ingest in part otherwise it will throw an error over large dataset
  for (let i = 0; i < faqs.length; i += BATCH_SIZE) {
    const batchFaqs = faqs.slice(i, i + BATCH_SIZE);
    const batchTexts = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batchTexts);

    for (let j = 0; j < batchFaqs.length; j++) {
      store.upsert({
        id: batchFaqs[j].id,
        category: batchFaqs[j].category,
        text: batchTexts[j],
        embedding: embeddings[j],
      });
    }
  }

  return faqs.length;
}
