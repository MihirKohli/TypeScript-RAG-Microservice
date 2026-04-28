import OpenAI from "openai";
import "dotenv/config";
import type { SearchResult } from "../types.js";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

const client = new OpenAI({ apiKey });

const SYSTEM_PROMPT = `You are a helpful customer support assistant for Beem, an AI-first fintech platform.

RULES:
- Answer ONLY using the provided FAQ context below. Do not use outside knowledge.
- If the context does not contain enough information to answer, say so honestly.
- Be concise and direct. Users want quick answers.
- When referencing specific details (limits, timelines, fees), use the exact figures from the context.
- Never invent product features, policies, or numbers that aren't in the context.`;

function buildContextBlock(results: SearchResult[]): string {
  return results
    .map(
      (r) =>
        `[${r.chunk.id} | ${r.chunk.category}]\n${r.chunk.text}`
    )
    .join("\n\n---\n\n");
}

/**
 * takes retrieved faq chunks as context and asks gpt-4o-mini to answer the question
 * @param question - user question string
 * @param results - top-k search results from the vector store
 * @returns answer string from the llm
 */
export async function generateAnswer(
  question: string,
  results: SearchResult[]
): Promise<string> {
  const context = buildContextBlock(results);

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `FAQ Context:\n${context}\n\nUser Question: ${question}`,
      },
    ],
  });

  return res.choices[0]?.message?.content ?? "I was unable to generate an answer.";
}


/**
 * embed a single text into a vector using text-embedding-3-small
 * @param text - text string to embed
 * @returns array of 1536 floats (embedding vector)
 */
export async function embed(text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
}

/**
 * embed multiple texts in one api call to save round trips
 * @param texts - array of text strings to embed
 * @returns array of embedding vectors in the same order as input
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  // sort by index to make sure order matches the input array
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
