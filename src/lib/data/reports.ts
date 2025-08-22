import { unstable_cache, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase";
import { Section } from "@/lib/jsonTreeModels/types/section";

const supabaseAdmin = createServiceRoleClient();

type ReportData = {
  sections: Section[];
} | null;

/**
 * Fetches the sections for a given report, leveraging Next.js's
 * built-in server-side cache.
 * @param reportId The ID of the report to fetch.
 * @returns The report's sections, or null if not found.
 */
export const getReportSectionsForChat = async (
  reportId: string
): Promise<ReportData> => {
  const cachedData = await unstable_cache(
    async () => {
      console.log(
        `[Cache] Cache miss for report: ${reportId}. Fetching from DB.`
      );
      const { data, error } = await supabaseAdmin
        .from("reports")
        .select("sections_json")
        .eq("id", reportId)
        .single();

      if (error) {
        console.error(`[DB Error] Failed to fetch report ${reportId}:`, error);
        return null; // Return null on error
      }

      return {
        sections: data?.sections_json?.sections || [],
      };
    },
    [`report:${reportId}`], // Unique cache key
    {
      tags: [`report:${reportId}`], // Tag for on-demand revalidation
      revalidate: 60 * 60, // Optional: fallback revalidation (1 hour)
    }
  )();

  // --- Failsafe for Stale Cache ---
  // If the cached data is an empty array, it might be stale.
  // Double-check the DB directly to ensure we're not acting on old info.
  if (cachedData && cachedData.sections.length === 0) {
    console.log(`[Cache Failsafe] Cached data for ${reportId} is empty. Verifying with direct DB lookup.`);
    const directDbData = await getReportSectionsFromDB(reportId);
    if (directDbData && directDbData.sections.length > 0) {
      console.log(`[Cache Failsafe] Stale cache detected. Found fresh data in DB for ${reportId}.`);
      // Revalidate the tag in the background to fix the cache for the next request
      revalidateTag(`report:${reportId}`);
      return directDbData;
    }
  }
  
  return cachedData;
};

/**
 * Fetches the sections for a given report directly from the database,
 * bypassing the Next.js cache.
 * @param reportId The ID of the report to fetch.
 * @returns The report's sections, or null if not found.
 */
export const getReportSectionsFromDB = async (
  reportId: string
): Promise<ReportData> => {
  console.log(
    `[DB Direct] Bypassing cache for report: ${reportId}. Fetching directly from DB.`
  );
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("sections_json")
    .eq("id", reportId)
    .single();

  if (error) {
    console.error(`[DB Error] Failed to fetch report ${reportId}:`, error);
    return null; // Return null on error
  }

  return {
    sections: data?.sections_json?.sections || [],
  };
};