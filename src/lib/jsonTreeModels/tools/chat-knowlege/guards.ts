import { getRelevantKnowledgeChunks } from "./retrieval";
import { SupabaseClient } from '@supabase/supabase-js';

// -------------------- Config --------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ITEMS = 100;
const MAX_SPECS_CHARS = 3000; // cap what you return to the model
export const EMBEDDING_GATE_THRESHOLD = 0.4; // used by your route orchestration

// -------------------- Helpers --------------------
function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

// -------------------- In-memory LRU --------------------
type CacheEntry = { data: string; timestamp: number };

const cache = new Map<string, CacheEntry>();

function getFromCache(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  // expire
  if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  // true LRU: reinsert to move to most-recent
  cache.delete(key);
  cache.set(key, { ...entry, timestamp: entry.timestamp });
  return entry.data;
}

function putInCache(key: string, data: string): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { data, timestamp: Date.now() });

  if (cache.size > CACHE_MAX_ITEMS) {
    // evict least-recently-used (first key)
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

// -------------------- Stage 1: Heuristic Gate --------------------
export function ruleGate(text: string): boolean {
  const t = text.toLowerCase();

  const specTriggers = [
    /\bas per spec\b/,
    /\b(spec|specification|standard|code|requirement)s?\b/,
    /\b(minimum|required|allowable|compliance)\b/,
    /\bmust\b/,
    /\bfastener spacing\b|\bthickness\b|\boverlap\b/,
  ];
  if (specTriggers.some((rx) => rx.test(t))) return true;

  const stylingOnly = /\b(reword|shorten|format|title|heading|tone)\b/;
  if (stylingOnly.test(t)) return false;

  const isQuestion = /(\?|^(what|should|can|is|are|does|do)\b)/.test(t);
  return isQuestion;
}

// -------------------- Stage 2: Embedding Gate (Stub) --------------------
export async function embeddingGate(
  projectId: string,
  query: string
): Promise<{ topScore: number }> {
  console.log("[Embedding Gate] Stub. Returning low score.");
  return { topScore: 0.1 };
}

// -------------------- Stage 3: Retrieval Tool & Logic --------------------
export const searchProjectSpecsTool = {
  type: "function" as const,
  function: {
    name: "search_project_specs",
    description:
      "Search the project's specifications when the answer depends on exact requirements, codes, or standards. Do NOT call for stylistic edits or simple section organization.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A concise search query describing what you need to look up.",
        },
        topK: {
          type: "integer",
          minimum: 1,
          maximum: 5,
          default: 3,
          description: "Number of chunks to return (small is better).",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export type SpecSearchResult = {
  success: true;
  data: {
    chunks: string;
    truncated: boolean;
    sourceCount?: number;
  };
} | {
  success: false;
  error: string;
};

export async function handleSpecSearch(
  supabase: SupabaseClient,
  projectId: string,
  queryRaw: string,
  topK = 3
): Promise<SpecSearchResult> {
  const q = normalizeQuery(queryRaw);
  if (!q) return { success: false, error: "Empty query." };

  const cacheKey = `${projectId}:${q}:${topK}`;
  const cached = getFromCache(cacheKey);
  if (cached !== null) {
    return {
      success: true,
      data: {
        chunks: cached.slice(0, MAX_SPECS_CHARS),
        truncated: cached.length > MAX_SPECS_CHARS,
      }
    };
  }

  try {
    const full = await getRelevantKnowledgeChunks(supabase, projectId, q, topK);
    const text = String(full ?? "");
    putInCache(cacheKey, text);

    return {
      success: true,
      data: {
        chunks: text.slice(0, MAX_SPECS_CHARS),
        truncated: text.length > MAX_SPECS_CHARS,
      }
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Spec search failed." };
  }
}
