import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
//generate report api route - includes training documents

interface ReportImage {
  url: string;
  description: string;
}

interface ReferenceDocument {
  url: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: NextRequest) {
  try {
    const { bulletPoints, contractName, location, reportId } = await req.json();
    console.log('Received request data:', { bulletPoints, contractName, location, reportId });

    if (!bulletPoints) {
      return NextResponse.json(
        { error: 'Bullet points are required' },
        { status: 400 }
      );
    }

    // Fetch report images if reportId is provided
    let imagesWithUrls: ReportImage[] = [];
    if (reportId) {
      console.log('Fetching images for report:', reportId);
      const { data: images, error: imagesError } = await supabase
        .from('report_images')
        .select('url, description')
        .eq('report_id', reportId);

      if (imagesError) {
        console.error('Error fetching images:', imagesError);
      }

      console.log('Fetched images:', images);

      if (images) {
        imagesWithUrls = await Promise.all(images.map(async image => {
          const { data, error } = await supabase.storage
            .from('reports-images')
            .createSignedUrl(image.url, 60 * 60 * 8); // 8 hours in seconds

          if (error) {
            console.error('Error generating signed URL:', error);
            return image;
          }

          console.log('Generated signed URL for image:', {
            original: image.url,
            signed: data.signedUrl
          });
          return {
            ...image,
            url: data.signedUrl
          };
        }));
      }
    }

    console.log('Final images with URLs:', imagesWithUrls);

    // Generate signed URLs for reference documents
    let referenceDocsWithUrls: ReferenceDocument[] = [];
    const { data: referenceDocs, error: referenceError } = await supabase
      .from('report_references')
      .select('file_path')
      .limit(5)
      .order('created_at', { ascending: false });
    
    if (referenceError) {
      console.error('Error fetching reference documents:', referenceError);
    }

    if (referenceDocs) {
      referenceDocsWithUrls = await Promise.all(referenceDocs.map(async doc => {
        const { data, error } = await supabase.storage
          .from('reference-reports')
          .createSignedUrl(doc.file_path, 60 * 60 * 8); // 8 hours in seconds

        if (error) {
          console.error('Error generating signed URL for reference document:', error);
          return { url: '' }; // Return empty URL on error
        }

        console.log('Generated signed URL for reference document:', {
          original: doc.file_path,
          signed: data.signedUrl
        });

        return {
          url: data.signedUrl
        };
      }));
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

    // Get signed URL for the template
    const { data: templateUrl, error: templateUrlError } = await supabase.storage
      .from('report-templates')
      .createSignedUrl(templateDoc.file_path, 60 * 60 * 8); // 8 hours in seconds

    if (templateUrlError) {
      console.error('Error generating signed URL for template:', templateUrlError);
      return NextResponse.json(
        { error: 'Failed to access report template' },
        { status: 500 }
      );
    }

    // Create a prompt for GPT
    let prompt = `
You are an expert engineering report writer for a professional engineering firm. 
Generate a detailed, professional report based on the following observations for ${contractName || 'a contract'} located at ${location || 'the specified location'}.

CRITICAL: You MUST use the provided template document as your exact structure. The template is available at: ${templateUrl.signedUrl}

Instructions for using the template:
1. Download and open the template document
2. Fill in each section with relevant content based on the observations and images
3. Maintain all formatting, styles, and structure from the template
4. Do not add or remove any sections
5. Keep all headers, footers, and page numbers as they appear in the template

${imagesWithUrls.length > 0 ? `
IMPORTANT INSTRUCTIONS FOR IMAGE ANALYSIS:
- Each image must be referenced in the appropriate section of the report
- When referencing an image, describe what it shows and how it relates to your analysis
- Use the images to support your observations and recommendations
- If an image shows a problem or issue, explain its significance
- If an image shows a feature or condition, describe its importance
- The image URLs are direct links that can be opened in a browser to view the full images

Images to be referenced:
${imagesWithUrls.map((img, index) => `Image ${index + 1}${img.description ? ` (${img.description})` : ''}: ${img.url}`).join('\n')}` : ''}

Bullet point observations to expand upon:
${bulletPoints}

${referenceDocsWithUrls.length > 0 ? `Reference documents to guide your writing style and format:
${referenceDocsWithUrls.map((doc, index) => `Reference Report ${index + 1}: ${doc.url}`).join('\n')}` : ''}

Remember to:
1. Maintain a professional and technical tone throughout
2. Be specific and detailed in your observations
3. Support all findings with evidence from the images
4. Provide clear, actionable recommendations
5. Follow the exact template structure provided`;

    console.log('Generated prompt:', prompt);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    // Extract the generated content
    const generatedContent = response.choices[0]?.message.content || '';
    console.log('Generated content:', generatedContent);

    return NextResponse.json({
      generatedContent,
      templateUrl: templateUrl.signedUrl
    });
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
} 