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
  },
  {
    title: "Engineering an AI Artifact Runtime: HTML All You Need",
    excerpt: "A Medium article on engineering an AI artifact runtime with an HTML-first approach.",
    url: "https://medium.com/@provatar0/engineering-an-ai-artifact-runtime-html-all-you-need-93c40bc7fa5b",
    platform: "Medium",
    type: "article",
    topic: "AI Engineering",
    publishedAt: "2024-10-15",
    status: "published",
    cover: "assets/AI Artifact Runtime Blueprint.png",
    coverAlt: "Engineering an AI Artifact Runtime architecture illustration",
    tags: ["AI Engineering", "HTML", "Artifact Runtime"]
  }
];
