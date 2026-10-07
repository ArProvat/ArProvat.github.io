// Add real publications here. Only status: 'published' entries with a valid
// HTTPS/HTTP URL and publication date appear on the public site.
// Fields: title, excerpt, url, platform, type ('article'|'post'|'note'),
// publishedAt (YYYY-MM-DD), topic, tags?, cover?, coverAlt?, readingMinutes?,
// featured?, status, secondaryLinks? [{ platform, url, type? }].
window.WRITING_ARTICLES = [
  {
    title: "Building Betopia AI’s Agentic Search Engine: From Web Search to Evidence-Grounded Research",
    excerpt: "When you build web search for an LLM assistant, the first prototype takes an afternoon. The real engineering begins when handling multi-provider fallbacks, Reciprocal Rank Fusion (RRF), in-memory BM25 retrieval, and verified citation evidence pipelines.",
    url: "https://www.linkedin.com/pulse/building-betopia-ais-agentic-search-engine-from-web-research-rahman-6wyfc/",
    platform: "LinkedIn",
    type: "article",
    topic: "RAG & Agents",
    publishedAt: "2026-09-10",
    readingMinutes: 8,
    featured: true,
    status: "published",
    cover: "assets/betopia-search-cover.jpg",
    coverAlt: "Building Betopia AI’s Agentic Search Engine architecture diagram",
    tags: ["Agentic AI", "RAG", "Reciprocal Rank Fusion", "BM25", "FastAPI"]
  }
];

// Design preview only: /writing/?preview=1. These are intentionally not links
// and are never treated as published work.
window.WRITING_SAMPLES = [
  {
    title: 'Sample: Designing an AI feature around the user workflow',
    excerpt: 'A sample summary showing how a practical engineering article could introduce the problem and its implementation choices.',
    platform: 'Medium', type: 'article', topic: 'AI Engineering',
    featured: true, status: 'sample'
  },
  {
    title: 'Sample: Measuring latency in an LLM inference service',
    excerpt: 'A sample note on the signals to collect before deciding where an inference pipeline needs attention.',
    platform: 'LinkedIn', type: 'post', topic: 'LLM Inference', status: 'sample'
  },
  {
    title: 'Sample: Retrieval checks before adding an agent',
    excerpt: 'A sample article description about evaluating retrieval quality and keeping tool use grounded.',
    platform: 'Medium', type: 'article', topic: 'RAG & Agents', status: 'sample'
  },
  {
    title: 'Sample: A small backend release checklist',
    excerpt: 'A sample note about API contracts, observability, and deployment checks in a small service.',
    platform: 'Other platform', type: 'note', topic: 'Backend', status: 'sample'
  }
];
