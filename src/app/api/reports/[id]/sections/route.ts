import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { Section } from '@/lib/jsonTreeModels/types/section';
import { revalidateTag } from 'next/cache';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const reportId = params.id;
  if (!reportId) {
    return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
  }

  try {
    const { sections } = await req.json() as { sections: Section[] };
    if (!sections) {
      return NextResponse.json({ error: 'Sections data is required' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // First, prune any future edits to handle branching history
    const { error: pruneError } = await supabaseAdmin.rpc('prune_future_edits', { p_report_id: reportId });

    if (pruneError) {
      console.error(`[API] Failed to prune future edits for report ${reportId}:`, pruneError);
      throw pruneError;
    }

    // Now, update the sections, which will create a new edit via the trigger
    const { data, error } = await supabaseAdmin
      .from('reports')
      .update({ sections_json: { sections } })
      .eq('id', reportId)
      .select('current_edit_number') // Use the new column
      .single();

    if (error) {
      console.error(`[API] Failed to save sections for report ${reportId}:`, error);
      throw error;
    }

    // --- Cache Invalidation Step ---
    revalidateTag(`report:${reportId}`);
    console.log(`[Cache] Revalidated tag for report: ${reportId}`);

    return NextResponse.json({ 
        success: true, 
        message: 'Sections saved successfully.',
        newEditNumber: data.current_edit_number // Return the new number
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[API] Error in POST /reports/${reportId}/sections:`, errorMessage);
    return NextResponse.json({ error: `Failed to save sections: ${errorMessage}` }, { status: 500 });
  }
}
