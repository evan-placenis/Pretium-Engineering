"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProjectSpecsTool = exports.EMBEDDING_GATE_THRESHOLD = void 0;
exports.getRelevantKnowledgeChunks = getRelevantKnowledgeChunks;
exports.ruleGate = ruleGate;
exports.embeddingGate = embeddingGate;
exports.handleSpecSearch = handleSpecSearch;
const openai_1 = require("openai");
// -------------------- Retrieval Logic --------------------
const MAX_PAYLOAD_CHARS = 4000;
async function getRelevantKnowledgeChunks(supabase, projectId, query, topK = 3) {
    try {
        const openai = new openai_1.OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-large',
            input: query,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;
        const { data, error } = await supabase.rpc('search_embeddings', {
            query_embedding: queryEmbedding,
            project_id: projectId,
            match_threshold: 0.5,
            match_count: topK,
        });
        if (error) {
            console.error('Database search error:', error);
            return '';
        }
        const results = data || [];
        if (results.length === 0)
            return '';
        const enhancedResults = await Promise.all(results.map(async (result) => {
            const { data: knowledgeData } = await supabase
                .from('project_knowledge')
                .select('file_name')
                .eq('id', result.knowledge_id)
                .single();
            return {
                content: result.content_chunk,
                fileName: knowledgeData?.file_name || 'Unknown file',
            };
        }));
        let totalChars = 0;
        const knowledgeChunks = [];
        for (const result of enhancedResults) {
            const chunk = `[From ${result.fileName}]:\n${result.content}`;
            if (totalChars + chunk.length > MAX_PAYLOAD_CHARS)
                break;
            knowledgeChunks.push(chunk);
            totalChars += chunk.length;
        }
        return `\n\n--- RELEVANT SPECIFICATIONS ---\n${knowledgeChunks.join('\n\n')}`;
    }
    catch (error) {
        console.error('Error getting relevant knowledge chunks:', error);
        return '';
    }
}
// -------------------- Config --------------------
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ITEMS = 100;
const MAX_SPECS_CHARS = 3000; // cap what you return to the model
exports.EMBEDDING_GATE_THRESHOLD = 0.4; // used by your route orchestration
// -------------------- Helpers --------------------
function normalizeQuery(q) {
    return q.toLowerCase().trim().replace(/\s+/g, " ");
}
const cache = new Map();
function getFromCache(key) {
    const entry = cache.get(key);
    if (!entry)
        return null;
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
function putInCache(key, data) {
    if (cache.has(key))
        cache.delete(key);
    cache.set(key, { data, timestamp: Date.now() });
    if (cache.size > CACHE_MAX_ITEMS) {
        // evict least-recently-used (first key)
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined)
            cache.delete(oldestKey);
    }
}
// -------------------- Stage 1: Heuristic Gate --------------------
function ruleGate(text) {
    const t = text.toLowerCase();
    const specTriggers = [
        /\bas per spec\b/,
        /\b(spec|specification|standard|code|requirement)s?\b/,
        /\b(minimum|required|allowable|compliance)\b/,
        /\bmust\b/,
        /\bfastener spacing\b|\bthickness\b|\boverlap\b/,
    ];
    if (specTriggers.some((rx) => rx.test(t)))
        return true;
    const stylingOnly = /\b(reword|shorten|format|title|heading|tone)\b/;
    if (stylingOnly.test(t))
        return false;
    const isQuestion = /(\?|^(what|should|can|is|are|does|do)\b)/.test(t);
    return isQuestion;
}
// -------------------- Stage 2: Embedding Gate (Stub) --------------------
async function embeddingGate(projectId, query) {
    console.log("[Embedding Gate] Stub. Returning low score.");
    return { topScore: 0.1 };
}
// -------------------- Stage 3: Retrieval Tool & Logic --------------------
exports.searchProjectSpecsTool = {
    type: "function",
    function: {
        name: "search_project_specs",
        description: "Search the project's specifications when the answer depends on exact requirements, codes, or standards. Do NOT call for stylistic edits or simple section organization.",
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
async function handleSpecSearch(supabase, projectId, queryRaw, topK = 3) {
    const q = normalizeQuery(queryRaw);
    if (!q)
        return { ok: false, error: "Empty query." };
    const cacheKey = `${projectId}:${q}:${topK}`;
    const cached = getFromCache(cacheKey);
    if (cached !== null) {
        return {
            ok: true,
            chunks: cached.slice(0, MAX_SPECS_CHARS),
            truncated: cached.length > MAX_SPECS_CHARS,
        };
    }
    try {
        const full = await getRelevantKnowledgeChunks(supabase, projectId, q, topK);
        const text = String(full ?? "");
        putInCache(cacheKey, text);
        return {
            ok: true,
            chunks: text.slice(0, MAX_SPECS_CHARS),
            truncated: text.length > MAX_SPECS_CHARS,
        };
    }
    catch (err) {
        return { ok: false, error: err?.message ?? "Spec search failed." };
    }
}
//# sourceMappingURL=guards.js.map