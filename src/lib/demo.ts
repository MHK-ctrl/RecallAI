/**
 * A fully synthetic, read-only workspace used by /demo. It contains no real user
 * data and never touches the database. Search and answers are computed locally
 * with the same retrieval ideas (BM25-ish term scoring + extractive answers), so
 * the demo is honest about what it is.
 */

export type DemoUnit = { page?: number; section?: string; text: string };
export type DemoDocument = {
  id: string;
  title: string;
  filename: string;
  fileType: "pdf" | "md" | "docx" | "txt" | "csv" | "image";
  added: string;
  units: DemoUnit[];
};

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: "demo-dbms",
    title: "DBMS — Normalization Notes",
    filename: "DBMS_Normalization_Notes.pdf",
    fileType: "pdf",
    added: "2026-09-14",
    units: [
      {
        page: 3,
        section: "Functional dependencies",
        text: "A functional dependency X → Y means that each value of X determines exactly one value of Y. In a relation, the left-hand side is the determinant. Partial dependencies occur when a non-key attribute depends on only part of a composite key, which violates second normal form.",
      },
      {
        page: 24,
        section: "Normal forms",
        text: "Normalization organises tables to reduce redundancy and avoid update anomalies. First normal form requires atomic values and no repeating groups. Second normal form removes partial dependencies. Third normal form removes transitive dependencies, so every non-key attribute depends only on the key.",
      },
      {
        page: 26,
        section: "BCNF and denormalization",
        text: "Boyce-Codd normal form strengthens 3NF: every determinant must be a candidate key. In practice teams denormalize deliberately for read performance, then document the trade-off. Normalization is a design discipline, not a law.",
      },
    ],
  },
  {
    id: "demo-distributed",
    title: "Distributed Systems — Lecture 7",
    filename: "distributed-systems-lecture-7.md",
    fileType: "md",
    added: "2026-10-02",
    units: [
      {
        section: "Two-phase locking",
        text: "Two-phase locking (2PL) has a growing phase where a transaction acquires locks and a shrinking phase where it releases them. Strict two-phase locking holds all locks until commit, which prevents cascading aborts and keeps schedules recoverable.",
      },
      {
        section: "Deadlock",
        text: "Deadlock happens when two transactions each hold a lock the other needs. Detection builds a wait-for graph and aborts a victim. Prevention uses timestamps: wait-die lets older transactions wait, wound-wait aborts the younger requester.",
      },
      {
        section: "Isolation levels",
        text: "Serializable is the strongest isolation level. Snapshot isolation avoids many anomalies but allows write skew. Read committed prevents dirty reads but not non-repeatable reads.",
      },
    ],
  },
  {
    id: "demo-architecture",
    title: "RecallAI — Architecture Notes",
    filename: "recallai-architecture.md",
    fileType: "md",
    added: "2026-10-21",
    units: [
      {
        section: "Ingestion pipeline",
        text: "The ingestion pipeline validates file signatures, extracts text page by page, cleans whitespace, then splits content into overlapping chunks of roughly 750 tokens with 120 tokens of overlap. Every chunk keeps its document, owner, page range and section heading.",
      },
      {
        section: "Retrieval",
        text: "Retrieval is hybrid: PostgreSQL full-text search contributes a keyword ranking, pgvector cosine similarity contributes a semantic ranking, and Reciprocal Rank Fusion merges the two lists. Results are always filtered by the authenticated user id.",
      },
      {
        section: "Answer generation",
        text: "Before calling a language model, the system retrieves a small set of chunks and numbers them. The model is instructed to cite those numbers only. A validator strips citation markers that do not exist, and the extractive fallback is used when the reply has no valid citations.",
      },
    ],
  },
  {
    id: "demo-networks",
    title: "Computer Networks — Revision Sheet",
    filename: "Computer_Networks_Revision.pdf",
    fileType: "pdf",
    added: "2026-08-30",
    units: [
      {
        page: 5,
        section: "TCP handshake",
        text: "The TCP three-way handshake exchanges SYN, SYN-ACK and ACK to agree on sequence numbers before data flows. Connection teardown uses FIN and ACK in both directions, with a TIME_WAIT state to absorb delayed segments.",
      },
      {
        page: 9,
        section: "Congestion control",
        text: "TCP congestion control uses a congestion window. Slow start doubles the window each round trip until the slow-start threshold, then congestion avoidance grows it linearly. Loss triggers fast retransmit and reduces the window.",
      },
      {
        page: 12,
        section: "DNS",
        text: "DNS resolves names through a hierarchy of root, TLD and authoritative servers. Recursive resolvers cache answers according to the record TTL, which is why DNS changes are not instant.",
      },
    ],
  },
  {
    id: "demo-plan",
    title: "Screenshot — Semester Plan",
    filename: "semester-plan-screenshot.png",
    fileType: "image",
    added: "2026-09-01",
    units: [
      {
        page: 1,
        text: "OCR text from screenshot: Semester 4 plan. Database systems revision on Monday and Thursday. Distributed systems assignment due 18 October. Computer networks lab report due 25 October. Project milestone: document search application with citations, demo by end of November.",
      },
    ],
  },
  {
    id: "demo-csv",
    title: "Reading List",
    filename: "reading-list.csv",
    fileType: "csv",
    added: "2026-10-11",
    units: [
      {
        section: "Rows 2–5",
        text: "Title: Designing Data-Intensive Applications | Author: Martin Kleppmann | Topic: distributed systems, replication, consistency. Title: Database System Concepts | Author: Silberschatz | Topic: relational algebra, normalization, transactions. Title: Introduction to Algorithms | Author: Cormen | Topic: dynamic programming, greedy algorithms, graph search.",
      },
    ],
  },
];

export const DEMO_QUESTIONS = [
  "What do my notes say about normalization?",
  "Where did I write about two-phase locking?",
  "Find the screenshot with my semester plan",
  "What is my project architecture for retrieval?",
  "Which reading covers dynamic programming?",
];

export type DemoHit = {
  documentId: string;
  title: string;
  fileType: string;
  page: number | null;
  section: string | null;
  text: string;
  excerpt: string;
  score: number;
};

const STOP = new Set([
  "the", "and", "for", "with", "what", "where", "when", "which", "about", "from", "that",
  "this", "have", "has", "did", "does", "was", "were", "are", "you", "your", "our", "find",
  "show", "tell", "explain", "saved", "save", "say", "says", "notes", "note", "document",
  "documents", "mention", "mentions", "into", "over", "under", "they", "them",
]);

export function demoTerms(query: string): string[] {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !STOP.has(word)),
    ),
  ).slice(0, 8);
}

function snippet(text: string, terms: string[], max = 260): string {
  if (terms.length === 0) return text.slice(0, max);
  const lower = text.toLowerCase();
  const positions = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  if (positions.length === 0) return text.slice(0, max);
  const start = Math.max(0, Math.min(...positions) - 70);
  const slice = text.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${slice.trim()}${start + max < text.length ? "…" : ""}`;
}

export function demoSearch(query: string, limit = 6): DemoHit[] {
  const terms = demoTerms(query);
  if (terms.length === 0) return [];
  const hits: DemoHit[] = [];

  for (const document of DEMO_DOCUMENTS) {
    for (const unit of document.units) {
      const haystack = `${document.title} ${unit.section ?? ""} ${unit.text}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
        if ((unit.section ?? "").toLowerCase().includes(term)) score += 1.2;
        if (document.title.toLowerCase().includes(term)) score += 1.4;
        const occurrences = unit.text.toLowerCase().split(term).length - 1;
        score += Math.min(occurrences, 4) * 0.35;
      }
      if (score > 0) {
        hits.push({
          documentId: document.id,
          title: document.title,
          fileType: document.fileType,
          page: unit.page ?? null,
          section: unit.section ?? null,
          text: unit.text,
          excerpt: snippet(unit.text, terms),
          score,
        });
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export type DemoCitation = {
  index: number;
  title: string;
  fileType: string;
  page: number | null;
  section: string | null;
  excerpt: string;
};

export type DemoAnswer = { answer: string; citations: DemoCitation[] };

export function demoAnswer(query: string): DemoAnswer {
  const hits = demoSearch(query, 3);
  if (hits.length === 0) {
    return {
      answer:
        "I could not find anything in this sample library for that question. The demo library only contains six synthetic documents, so try one of the suggested questions.",
      citations: [],
    };
  }

  const terms = demoTerms(query);
  const lines: string[] = [];
  const citations: DemoCitation[] = [];

  hits.forEach((hit, index) => {
    const sentences = hit.text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 40);
    const best =
      sentences.find((sentence) => terms.some((term) => sentence.toLowerCase().includes(term))) ??
      sentences[0];
    if (!best) return;
    citations.push({
      index: index + 1,
      title: hit.title,
      fileType: hit.fileType,
      page: hit.page,
      section: hit.section,
      excerpt: hit.excerpt,
    });
    lines.push(`- “${best.length > 300 ? `${best.slice(0, 297)}…` : best}” [${index + 1}]`);
  });

  return {
    answer: [
      "Based on this sample library:",
      "",
      ...lines.slice(0, 3),
      "",
      "_Demo answer assembled from the synthetic sample documents. It is not generated by a language model and is not your data._",
    ].join("\n"),
    citations,
  };
}
