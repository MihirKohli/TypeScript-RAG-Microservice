## Setup Guide
rename `.env.example` to `.env` and add your openai key, then run:

```bash
npm install
npm run dev
```

---

## LLM Provider

i used openai for both embedding and generation

- embedding: `text-embedding-3-small` — sota on retrieval benchmarks, cheap, 1536 dims
- generation: `gpt-4o-mini` — fast, cheap, good instruction following for grounded QA

---

## Chunking Strategy

**do you embed the question alone, the answer alone, or both together?**

both together as `Q: {question}\nA: {answer}`

embedding only the answer would miss question-to-question similarity users phrase queries like questions, not like answers. embedding only the question throws away the actual content. combining both gives the vector a dual signal it matches queries that sound like the original question AND queries that contain terms from the answer

**how do you handle the category field?**

category is stored as metadata only, not embedded into the chunk text

if i added it to the text it would be a repeated label across many chunks and would dilute the semantic signal. instead it's used as a pre-retrieval filter you can pass `"category": "everdraft"` in the query body and the store filters candidates before cosine similarity runs

**what is your overlap strategy?**

chunk size is 1024 chars with 20 char overlap using a recursive character splitter. the splitter tries to break on paragraph breaks first, then newlines, then sentences, then words, then characters so it never cuts mid-sentence unless it has no choice. the 20 char overlap carries context from the end of one chunk into the start of the next so the boundary doesn't lose meaning

for the current 20 faqs (all under 600 chars) no splitting actually happens each faq stays as one chunk. the chunker is there so the system handles larger documents without breaking

---

## Known Limitations

- vector store is in-memory so data is lost on restart, would need to re-ingest every time server restarts
- brute force cosine search works fine for 20 faqs but won't scale, would swap to hnsw index for large datasets
- no streaming on /query response, llm answer is returned all at once, would add streaming for better 


## Sample Requests

**1. ingest**
```bash
curl -X POST http://localhost:4500/ingest \
  -H "Content-Type: application/json" \
  -d @data/beem_faqs.json
```

---

**2. health check**
```bash
curl http://localhost:4500/health
```
```json
{
  "status": "ok",
  "documents_in_store": 20,
  "uptime_seconds": 692
}
```

---

**3. query — how do i send money**
```bash
curl -X POST http://localhost:4500/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I send money?", "top_k": 3}'
```
```json
{
  "answer": "To send money using Beem, you can use the peer-to-peer transfer feature within the Beem app.",
  "sources": ["FAQ-008", "FAQ-009", "FAQ-004"],
  "latency_ms": 3790
}
```

---

**4. query — direct deposit changes**
```bash
curl -X POST http://localhost:4500/query \
  -H "Content-Type: application/json" \
  -d '{"question": "employers process direct deposit changes", "top_k": 3}'
```
```json
{
  "answer": "Most employers process direct deposit changes within 1-2 pay cycles.",
  "sources": ["FAQ-008", "FAQ-005", "FAQ-001"],
  "latency_ms": 2803
}
```

---

**5. query — account flagged**
```bash
curl -X POST http://localhost:4500/query \
  -H "Content-Type: application/json" \
  -d '{"question": "your account has been flagged", "top_k": 3}'
```
```json
{
  "answer": "Your account may be flagged for unusual activity, which can lead to declines in your Everdraft advances. If you believe this is an error, you should contact Beem support through the app for assistance.",
  "sources": ["FAQ-005", "FAQ-016", "FAQ-015"],
  "latency_ms": 2100
}
```

---

**6. query with category filter — everdraft fees**
```bash
curl -X POST http://localhost:4500/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the fees?", "top_k": 3, "category": "everdraft"}'
```
```json
{
  "answer": "Everdraft has no mandatory fees and charges zero interest. Beem offers an optional tip when you take an advance, which is entirely voluntary and does not affect your eligibility or limit. There are no late fees if your paycheck is delayed, and Beem never charges overdraft fees on Everdraft repayment.",
  "sources": ["FAQ-003", "FAQ-004", "FAQ-002"],
  "latency_ms": 2200
}
```

---

**7. query with category filter — unauthorized transactions**
```bash
curl -X POST http://localhost:4500/query \
  -H "Content-Type: application/json" \
  -d '{"question": "If you identify unauthorized transactions", "top_k": 3, "category": "account_management"}'
```
```json
{
  "answer": "If you identify unauthorized transactions, you should dispute them in the app within 60 days. Beem's Zero Liability policy means you are not responsible for unauthorized charges if reported promptly.",
  "sources": ["FAQ-015", "FAQ-016"],
  "latency_ms": 2660
}
```