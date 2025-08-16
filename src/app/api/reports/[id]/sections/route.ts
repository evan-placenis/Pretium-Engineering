import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import { Section } from '@/lib/jsonTreeModels/types/section';

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

    const { error } = await supabaseAdmin
      .from('reports')
      .update({ sections_json: { sections } })
      .eq('id', reportId);

    if (error) {
      console.error(`[API] Failed to save sections for report ${reportId}:`, error);
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Sections saved successfully.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`[API] Error in POST /reports/${reportId}/sections:`, errorMessage);
    return NextResponse.json({ error: `Failed to save sections: ${errorMessage}` }, { status: 500 });
  }
}
