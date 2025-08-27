// limiter.ts
import pLimit from 'p-limit';
export const globalLlmLimit = pLimit(5); // start at 5, tune from p95 latencies