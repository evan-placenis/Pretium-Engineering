//used for exporting the report to a word document
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import mammoth from 'mammoth';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      );
    }

    // Fetch the report and associated building
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*, buildings(*)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('Error fetching report:', reportError);
      return NextResponse.json(
        { error: 'Failed to fetch report' },
        { status: 404 }
      );
    }

    // Fetch the template document
    const { data: templateDoc, error: templateError } = await supabase
      .from('report_templates')
      .select('file_path')
      .eq('is_active', true)
      .single();
    
    if (templateError) {
      console.error('Error fetching template document:', templateError);
      return NextResponse.json(
        { error: 'Failed to fetch report template' },
        { status: 500 }
      );
    }

    // Get the template file from storage
    const { data: templateData, error: templateDataError } = await supabase.storage
      .from('report-templates')
      .download(templateDoc.file_path);

    if (templateDataError) {
      console.error('Error downloading template:', templateDataError);
      return NextResponse.json(
        { error: 'Failed to download template' },
        { status: 500 }
      );
    }

    // Convert template to buffer
    const templateBuffer = Buffer.from(await templateData.arrayBuffer());

    // Use mammoth to convert the template to HTML
    const { value: html } = await mammoth.convertToHtml({ buffer: templateBuffer });

    // Create a new document with the template structure
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: `Engineering Report: ${report.buildings?.name || 'Building'}`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          // Metadata
          new Paragraph({
            text: `Location: ${report.buildings?.location || 'N/A'}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Date: ${new Date(report.created_at).toLocaleDateString()}`,
            alignment: AlignmentType.CENTER,
          }),
          // Content
          ...generateDocumentContent(report),
        ],
      }],
    });

    // Pack the document to a buffer
    const buffer = await Packer.toBuffer(doc);

    // Create the response with the document
    const response = new NextResponse(buffer);
    response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    response.headers.set('Content-Disposition', `attachment; filename=Report_${report.buildings?.name || 'Building'}_${new Date().toISOString().split('T')[0]}.docx`);

    return response;
  } catch (error: any) {
    console.error('Error generating Word document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate Word document' },
      { status: 500 }
    );
  }
}

function generateDocumentContent(report: any) {
  const content: Paragraph[] = [];
  const reportContent = report.generated_content || '';
  
  // Process the content
  const lines = reportContent.split('\n');
  let currentParagraphText = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line might be a heading
    const isHeading = /^#+\s|^[A-Z][A-Z\s]+:|^[A-Z][A-Z\s]+$/.test(trimmedLine);
    
    if (isHeading) {
      // Flush any accumulated paragraph text
      if (currentParagraphText) {
        content.push(new Paragraph({ text: currentParagraphText }));
        currentParagraphText = '';
      }
      
      // Add the heading
      content.push(
        new Paragraph({
          text: trimmedLine.replace(/^#+\s/, '').replace(/:$/, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 400,
            after: 200,
          },
        })
      );
    } else if (trimmedLine === '') {
      // Flush paragraph on empty line
      if (currentParagraphText) {
        content.push(new Paragraph({ text: currentParagraphText }));
        currentParagraphText = '';
      }
      
      // Add an empty paragraph for spacing
      content.push(new Paragraph({ text: '' }));
    } else {
      // Add to current paragraph
      if (currentParagraphText) {
        currentParagraphText += ' ' + trimmedLine;
      } else {
        currentParagraphText = trimmedLine;
      }
    }
  }
  
  // Flush any remaining paragraph
  if (currentParagraphText) {
    content.push(new Paragraph({ text: currentParagraphText }));
  }

  return content;
} 


