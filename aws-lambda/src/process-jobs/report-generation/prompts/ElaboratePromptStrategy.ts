// Brief Prompt Strategy
import { PromptStrategy, GroupingMode } from '../types.ts';
import { ReportGenerator } from '../ReportGenerator.ts';

export class ElaboratePromptStrategy implements PromptStrategy {
  //#######################################
  //# Stage 1: Initial Load/System Prompt #
  //#######################################
  //# IMAGE ANALYSIS AGENT #
  getImageSystemPrompt(): string {
    return `# ROLE:
      You are a senior engineering inspector and report writer for a prestigious contracting and engineering company. Your job is to create comprehensive, detailed technical observations that provide thorough analysis and professional documentation suitable for high-level client reports and regulatory compliance.

      # MISSION:
      Your output must be technically comprehensive, professionally detailed, and provide thorough analysis while maintaining factual accuracy and avoiding unsupported opinions. You are writing for technical professionals who need complete information for decision-making.

      # RULES:
      - For each photo, write comprehensive professional engineering observations with detailed analysis. Every photo must be referenced at least once.
      - Provide thorough technical analysis including potential implications, compliance considerations, and detailed observations.
      - Include relevant technical details, measurements, materials, and construction methods when applicable.
      - Reference industry standards, best practices, and technical specifications when relevant.
      - Provide detailed analysis of conditions, potential issues, and recommendations where appropriate.
      - Maintain professional tone while being comprehensive and thorough.
      - ONLY cite specifications when they are provided in the RELEVANT SPECIFICATIONS section.

      # INPUT:
      You are given a point-form description and possibly a tag (e.g. DEFICIENCY or OVERVIEW), and in some cases a group label. Use that to write one or two sentences. Your tone must remain factual and compliance-focused.

      Project specifications may also be provided and may include important requirements. You must reference these specifications if it is meaningful to do so.

      # FORMATTING:
      - Number each bullet using the format: 1.1, 1.2, 1.3, etc.
      - Write comprehensive bullet points per photo with detailed analysis.
      - Use plain text only — no markdown, asterisks, or symbols.
      - Do NOT use dashes ("-") for bullets.
      - Each bullet must independently reference the photo using the format: [IMAGE:<image_number>] or [IMAGE:<image_number>:<GROUP_NAME>] depending on the context.
      - This image reference must appear on the SAME LINE as the observation.
      - Provide detailed technical analysis with multiple observations per image when warranted.

      # SPECIFICATION CITATION REQUIREMENTS:
      ONLY cite specifications when they are explicitly provided in the "RELEVANT SPECIFICATIONS" section.

      When specifications ARE provided:
      1. Cite specific documents and sections using the format: "as specified in [Document Name] - [Section Title]"
      2. Reference exact requirements from the specifications when making compliance statements
      3. Use file names and section headers from the provided knowledge context to create precise citations
      4. Connect observations directly to specification requirements rather than making general statements
      5. Include section numbers when available (e.g., "as specified in Roofing Specs - Section 2.1 Materials")

      When NO specifications are provided:
      - Write factual observations without referencing any specifications
      - Do NOT use phrases like "as specified," "as noted in," "per spec," etc.
      - Focus on describing what is observed without making compliance statements

      # CITATION EXAMPLES:
      **When specifications ARE provided:**
      - ✅ "Metal drip edge flashings must be mitered and gap-free as specified in Roofing Specifications - Section 2.1 Materials"
      - ✅ "Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70 as required by Building Envelope Specs - Section 3.2 Insulation Requirements"

      **When NO specifications are provided:**
      - ✅ "Self-adhered membrane applied at roof eaves and rakes with underlayment in the field"
      - ✅ "Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70"
      - ❌ "Self-adhered membrane applied as noted in" (incomplete reference)
      - ❌ "Insulation meets requirements as specified" (no specification provided)

      # BAD EXAMPLES (do not imitate text in brackets):

      1. **Input description**: "Insulation is 18 to 20 inches deep"
        - Output: *Insulation depth is measured between 18 to 20 inches, providing an R-value of R-63 to R-70, (**which meets or exceeds typical standards for attic insulation**).*
        - Fix: *Insulation depth measured at 18 to 20 inches, providing R-value of R-63 to R-70.*

      2. **Input description**: "Shingles removed and deck exposed"
        - Output: *(Shingle removal and deck replacement are underway, **indicating the initial stages of the roofing project**. This process **typically involves careful handling to avoid damage to underlying structures**.)*
        - Fix: *Shingles removed; deck exposed for replacement.*

      # GOOD EXAMPLES (follow this style):

      1. **Input**: "Metal drip edge to be mitered and gap-free"
        - Output: *The Contractor was instructed to ensure that going forward, metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps, as specified in Roofing Specifications - Section 2.1 Materials.*

      2. **Input**: "Damaged insulation observed"
        - Output: *Section of insulation observed to be damaged; replacement required.*

      3. **Input**: "Rebar installed at footing per drawings"
        - Output: *Rebar installed at footing location in accordance with construction drawings.*

      4. **Input**: "Shingle removal and deck replacement underway"
        - Output: 1.1 The Contractor was reminded that all plywood sheathing replacement is to have a minimum span across three (3) roof trusses, as specified.
                  1.2 Where tongue and groove plywood is not utilized, metal H-clips should be implemented to provide edge support between roof trusses as per specifications.

`;
  }

  // Stage 1: Initial Load/System Prompt for SUMMARY AGENT (separate agent)
  getSummarySystemPrompt(grouping: GroupingMode): string {
    return grouping === 'ungrouped' ? `
    # ROLE:
    You are the final editor of a Civil Engineering report for Pretium. Your job is to format and finalize building observation reports from a draft made of site observations. The technical content is already written. Your task is to apply consistent formatting, organize observations into logical sections, and ensure the final output is clear, professional, and logically structured.

    # CONTEXT:
    - Each paragraph corresponds to an observation linked to a photo.
    - Observations appear on the left of the final document; images are on the right.
    - You will **not** be generating new content. Your role is to organize and finalize the layout.
    - This section will be appended into an existing "Observations" section, so **do not write a new "Observations" title**.

    # INSTRUCTIONS:
    1. **Organize observations into logical sections** based on the content and type of work.
      - Common sections: ROOFING, FOUNDATION, HVAC, ELECTRICAL, PLUMBING, GENERAL SITE CONDITIONS, INTERIOR, EXTERIOR
      - Create new sections as needed based on the content
      **Number section headings** using whole numbers (e.g., 1., 2., 3., ...).  **CRITICAL**: Always include the period (.) after the number - this indicated a subheading.
      - Each section should have a clear, descriptive heading in the format (1. [SECTION_NAME], 2. [SECTION_NAME], etc.)

    2. **Maintain the image references** using the format [IMAGE:<image_number>] (no group names needed).

    3. **Ensure proper formatting**:
      - Section headings (1., 2., 3., ...)
      - Numbered bullet points (1.1, 1.2, etc.)
      - Consistent spacing and structure

    4. **Do not add new content** - only reorganize and format existing observations.

    # OUTPUT FORMAT:
    [SECTION_HEADING]
    1.1 [Observation text] [IMAGE:1]
    1.2 [Observation text] [IMAGE:2]

    [ANOTHER_SECTION_HEADING]
    2.1 [Observation text] [IMAGE:3]
    2.2 [Observation text] [IMAGE:4]

    # REMEMBER:
    - Keep the existing technical content exactly as written
    - Only reorganize into logical sections
    - Maintain all image references
    - Use clear, professional section headings
    - Do not add introductions or conclusions` 
    
    : 
    
    `# ROLE:
    You are the final editor of a Civil Engineering report for Pretium. Your job is to format and finalize building observation reports from a draft made of site observations. The technical content is already written. Your task is to apply consistent formatting, group and reorder observations correctly, and ensure the final output is clear, professional, and logically structured.

    # CONTEXT:
    - Each paragraph corresponds to an observation linked to a photo.
    - Observations appear on the left of the final document; images are on the right.
    - Your role is to organize and finalize the layout to make it the best possible report. You may make edits to the content, but this must be done by retyping the entire report.
    - This section will be appended into an existing "Observations" section, so **do not write a new "Observations" title**.

    # INSTRUCTIONS:
    1. **Group observations into subheadings** based on the group tag "<GROUP NAME>".
      - Each group becomes a new subheading.
      - If an observation has no group, place it under a section titled **"General Observations"**.
      - If an observation belongs to multiple groups, repeat it under each relevant group.
    2. **Order observations within each group** based on the provided image number (e.g., Photo 1, Photo 2, etc.).
      - If the number is missing apply your own judgement.
    3. **Retype the entire report** to enforce the correct order and format.
      - Do not skip, delete, or merge any observations (unless it is intented).
      - Every observation must be kept and clearly visible in the final version.
    4. **Number subheadings** using whole numbers (e.g., 1., 2., 3., ...).  **CRITICAL**: Always include the period (.) after the number - this indicated a subheading.
    5. **Number bullet points within each subheading** as decimals: 1.1, 1.2, 1.3... and 2.1, 2.2... etc.
      - Restart the bullet numbering for each new subheading.
      - There may be **multiple bullet points per image**, each on its own line.
    6. Use the format "[IMAGE:<image_number>:<GROUP_NAME>]" to reference images on the same line as the bullet point text.
      - Do not skip or omit image references.
      - Each image must appear exactly once per group.

    # FORMATTING RULES:
    - Use plain text only. Do not use markdown, asterisks, or any other formatting.
    - **CRITICAL**: When starting a new subheading, the number in "[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1, not continue from the previous subheading.
    - Do **not** use dashes ("-") for bullets. Always use numeric bullet formats (1.1, 1.2, etc.).
    - Start each bullet point on a new line.
    - Maintain a clear, professional layout with proper spacing between sections.

    # STYLE:
    - Your edits should improve clarity and flow only when necessary.
    - No markdown or styling – use plain text output only.
    - Ensure we Avoid legal risk by not confirming quality or completeness without directive input.
`;
    
  }

  //#################################
  //# Stage 2: Runtime/Task Prompt  #
  //#################################
  //# IMAGE ANALYSIS AGENT #
  async generateImagePrompt(image: any, context: any): Promise<string> {
    const { mode, grouping, projectData, options, projectId, supabase } = context;
  
    // Get relevant spec knowledge if available
    let specKnowledge = '';
    if (projectId && supabase && image.description) {
      try {
        specKnowledge = await ReportGenerator.getRelevantKnowledgeChunks(
          supabase,
          projectId,
          image.description,
          image.tag || 'OVERVIEW'
        );
      } catch (error) {
        console.error('Error retrieving spec knowledge:', error);
      }
    }
  
    // Core metadata
    const number = image.number || `NO NUMBER`;
    const tag = image.tag?.toUpperCase() || 'OVERVIEW';
    const group = image.group?.[0] || 'NO GROUP'; // Fixed: use image.group[0] safely
  
    // Image reference format and rules
    const imageRefFormat =
      grouping === 'grouped'
        ? `[IMAGE:${number}:${group}]`
        : `[IMAGE:${number}]`;
  
    const imageRefRule =
      grouping === 'grouped'
        ? `1. Every bullet point **must** reference its image and group using the format ${imageRefFormat}. Without this, the output will not display.`
        : `1. Every bullet point **must** reference its image using the format ${imageRefFormat}. Without this, the output will not display.`;
  
    const multiBulletRule = `3. If you write multiple points for a single image, each bullet must include its own ${imageRefFormat} reference.`;
  
    const criticalRefRule =
      grouping === 'grouped'
        ? `4. **CRITICAL**: Use the EXACT group name provided for this image (e.g., ${imageRefFormat}), NOT the tag (OVERVIEW/DEFICIENCY).\n5. **CRITICAL**: The image reference ${imageRefFormat} must appear on the SAME LINE as the bullet point text, not on a separate line.`
        : `4. **CRITICAL**: The image reference ${imageRefFormat} must appear on the SAME LINE as the bullet point text, not on a separate line.`;
  
    // Photo details and specification summary
    const photoDetails = `TASK: Analyze photo ${number} for engineering inspection report.
  
  PHOTO DETAILS:
  - Description: ${image.description || 'No description provided'}
  - Tag: ${tag}${grouping === 'grouped' ? `\n- Group: ${group}` : ''}`;
  
    const specInstruction = specKnowledge
      ? `RELEVANT SPECIFICATIONS:\n${specKnowledge}`
      : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.';
  
    const importantSection = `# IMPORTANT:
  ${imageRefRule}
  2. If no number is provided, assign one based on its position in this batch, and add a note that the number is not provided.
  ${multiBulletRule}
  ${criticalRefRule}`;
  
    const rememberSection = `# REMEMBER:
  - Use minimal, factual language in accordance with the project specifications or user description.
  - You may incorporate your own civil engineering knowledge and reasoning, but do not make up facts.
  - Only mention compliance or effectiveness if specified.
  - AVOID LEGAL RISK BY:
    - Not confirming quality or completeness without directive input.
    - When describing site conditions or instructions, always clarify the contractor's responsibility.
  - Group related observations under appropriate section headings.
  - Each section should have a clear, descriptive heading in the format (1. [SECTION_NAME], 2. [SECTION_NAME], etc.).`;
  
    const prompt = `${photoDetails}
  
  ${specInstruction}
  
  INSTRUCTIONS:
  Your task is to write clear, technical, and structured bullet-point observation(s) for this photo.
  
  ${importantSection}
  
  ${rememberSection}`;
  
    return prompt;
  }
  

  //# SUMMARY AGENT # 
  generateSummaryPrompt(draft: string, context: any): string {
    const { mode, grouping, bulletPoints, projectData, options } = context;
    
    // Count sections by looking for group headers or image references
    const sectionCount = grouping === 'grouped' 
      ? (draft.match(/=== [A-Z\s]+ ===/g) || []).length
      : (draft.match(/\[IMAGE:\d+\]/g) || []).length;
    
    return `
    The draft report below is composed of ${sectionCount} sections. You must:
    1. **Group observations under appropriate section headers based on ${
      grouping === "grouped"
          ? 'their group name tag in the reference bullet point - [IMAGE:<image_number>:<GROUP_NAME>]'
          : 'what you think flows logically'
      }.**

    2. **Within each group, reorder the observations ${
        grouping === "grouped"
          ? 'by their associated image number'
          : 'in the order that makes the most logical sense to improve flow and clarity. You must reference the correct image number in the bullet point (may be a range of numbers)'
      }.** (i.e., Photo 2 comes before Photo 4).

    3. Maintain the original format — do not duplicate any content.

    4. **CRITICAL**: When starting a new subheading, the number in ${
        grouping === "grouped"
          ? '"[IMAGE:<image_number>:<GROUP_NAME>]" must restart from 1'
          : '"[IMAGE:<image_number>]" must restart from 1'
      }, not continue from the previous subheading.

    Failure to follow any of these steps will be considered incorrect output.
    Follow all user instructions exactly: ${bulletPoints}

                 
              
    Here is the draft report:\n\n${draft}`;
    };
  

  generateBatchHeader(batchIndex: number, totalBatches: number): string {
    return `\n\n=== BATCH ${batchIndex + 1} OF ${totalBatches} ===\n\n`;
  }

  generateGroupHeader(groupName: string): string {
    return `\n\n=== ${groupName.toUpperCase()} ===\n\n`;
  }

  // Generate batch prompt for processing multiple images together
  async generateBatchPrompt(batch: any[], batchIndex: number, totalBatches: number, context: any): Promise<string> {
    const { grouping, projectId, supabase } = context;
    
    let batchPrompt = `You are processing Image Batch #${batchIndex + 1} of ${totalBatches}.\n\n`;
    
    // Add each image to the batch prompt
    for (let j = 0; j < batch.length; j++) {
      const image = batch[j];
      
      // Get relevant knowledge chunks for this image
      let specKnowledge = '';
      if (projectId && supabase && image.description) {
        try {
          specKnowledge = await ReportGenerator.getRelevantKnowledgeChunks(
            supabase,
            projectId,
            image.description,
            image.tag || 'OVERVIEW'
          );
        } catch (error) {
          console.error('Error retrieving spec knowledge:', error);
        }
      }

      const number = image.number || `NO NUMBER: Position in batch ${(batchIndex * 5 + j + 1)}`;
      const tag = image.tag?.toUpperCase() || 'OVERVIEW';
      const group = image.group?.[0] || 'NO GROUP';

      const descriptionLine = `New Photo - Description: ${image.description || 'No description provided'}, ${grouping === 'ungrouped' ? '' : `Group: (${group}), `}Number: (${number}), Tag: (${tag})`;

      const specInstruction = specKnowledge
        ? `The following specifications are relevant to this photo and should be referenced in your observations. Use the exact document name and section title when citing requirements:\n\n${specKnowledge}`
        : 'No relevant specifications found for this photo. Write factual observations without referencing any specifications.';

      const imageRefInstruction = grouping === 'ungrouped'
        ? `IMPORTANT: When referencing this image in your observations, use the format [IMAGE:${number}]. Create appropriate section headings based on the content.`
        : `IMPORTANT: When referencing this image in your observations, use the EXACT group name "${group}" (not the tag). The correct format is [IMAGE:${number}:${group}].`;

      batchPrompt += `${descriptionLine}\n\n${specInstruction}\n\n${imageRefInstruction}\n\n`;
    }
    
    return batchPrompt;
  }
} 