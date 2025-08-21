'use server';

import { revalidateTag } from 'next/cache';

/**
 * A Server Action to revalidate the cache tag for a specific report.
 * This can be called from client components to purge the server-side cache.
 * @param reportId The ID of the report whose cache tag should be revalidated.
 */
export async function revalidateReportTag(reportId: string) {
  try {
    const tag = `report:${reportId}`;
    console.log(`[Server Action] Revalidating tag: ${tag}`);
    revalidateTag(tag);
    return { success: true };
  } catch (error) {
    console.error('[Server Action Error] Failed to revalidate tag:', error);
    return { success: false, error: 'Failed to revalidate cache.' };
  }
}
