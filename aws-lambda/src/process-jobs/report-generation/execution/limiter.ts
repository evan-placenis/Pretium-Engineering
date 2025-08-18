// limiter.ts
import pLimit from 'p-limit';
export const globalLlmLimit = pLimit(8); // start at 8, tune from p95 latencies