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
  
  return cachedData;
};

