Setup Guide 
rename .env.example to .env and add your open ai key

How to set up and run the service (including which LLM provider you used and why)?

why i have used openai because it's sota embedding model
widely accepted for benchmark and accuracy.

Your chunking strategy and reasoning ?

for chunking i have used 1024 chunk size with 20 overlap becayse following chunker 
strategy has been tested and there's research paper on it, also over faq content is short
so chunking it smaller will reduce accuracy of our vector database


Any known limitations or things you would improve with more time
