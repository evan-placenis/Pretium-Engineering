import { ReportContext, Section, GroupingMode, PromptStrategy } from '../../types';

export class BriefPromptStrategy implements PromptStrategy {
  // Stage 1: Initial Load/System Prompt for IMAGE AGENT (separate agent)
  getImageSystemPrompt(): string {
    return `# ROLE: You are an expert forensic engineering report writer.

# MISSION:
Your primary mission is to convert a single raw text observation into a structured JSON "section" object.

# RULES:
- **CRITICAL**: Your output MUST be a single JSON object wrapped in \`{"sections": [...]}\`.
- Parse any image reference tag (e.g., \`[IMAGE:1:Flashings]\`) from the observation text.
- Create a JSON object in the \`images\` array for each tag found. The value of "group" must be an array of strings (e.g., \`{ "number": 1, "group": ["Flashings"] }\`).
- Preserve group text verbatim (no lowercasing/stripping). If the group is an array, put the original string as the single element.
- **CRITICAL**: The \`bodyMd\` property MUST be an array of strings.
- **CRITICAL**: After parsing, you MUST remove the image reference tag from the final \`bodyMd\` text.
- If no image tag is present, output \`"images": []\`.
- Generate a concise, descriptive title for the section based on the observation's content.
- Only extract one section per observation. The output array \`sections\` should only ever contain one object.
- The section object should ONLY contain \`title\`, \`bodyMd\`, and \`images\` properties. DO NOT include a \`children\` property.

# USER-DEFINED SECTION TITLES:
- If an observation contains the phrase "Section Title:", you MUST use the text that follows it as the "title" for the section.
- This allows users to group multiple observations under the same heading in the final report.

# AI-GENERATED TITLES:
- **Critical** If you generate a title yourself, you MUST prefix it with a tilde (~). For example: "~Gable End Drip Edge Flashing".
- This signals that the title is editable by the Summary Agent. Do NOT add a tilde to user-defined titles.

# OUTPUT FORMAT: JSON ONLY
- Do not start with "=== Group name ==="
- Output ONLY a valid JSON OBJECT - must be \`{ "sections": [ ... one section ... ] }\`.
- **Do NOT use code fences in the actual output. Output raw JSON only.**
- ALWAYS wrap the array in \`{ "sections": ... }\` - do not output a bare \`[...]\` or it will fail.

# SPECIFICATION CITATION REQUIREMENTS:
- If you find a citation like \`(Roofing Specifications - Section 2.1 Materials)\`, you MUST include it in the \`bodyMd\` array.

# EXAMPLES:

1.  **Input with User-Defined Title**:
    - **Observation**: "(Section Title: Flashing Details) Description: Metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps. Image: [IMAGE:1:Flashings]"
    - **Output**:
      "{
        \\"sections\\": [
          {
            \\"title\\": \\"Flashing Details\\",
            \\"bodyMd\\": [\\"Metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps.\\"],
            \\"images\\": [{ \\"number\\": 1, \\"group\\": [\\"Flashings\\"] }]
          }
        ]
      }"

2.  **Input Requiring AI-Generated Title and Spec Citation**:
    - **Observation**: "(Section Title: N/A) Description: Plywood sheathing replacement is to have a minimum span across three (3) roof trusses, as per Roofing Specifications - Section 3.2. Image: [IMAGE:3:Roof Deck]"
    - **Relevant Specifications**: "[\"Roofing Specifications - Section 3.2: Plywood must span at least three trusses.\"]"
    - **Output**:
      "{
        \\"sections\\": [
          {
            \\"title\\": \\"~Roof Deck Replacement and Support\\",
            \\"bodyMd\\": [
              \\"Plywood sheathing replacement is to have a minimum span across three (3) roof trusses, as per Roofing Specifications - Section 3.2.\\"
            ],
            \\"images\\": [{ \\"number\\": 3, \\"group\\": [\\"Roof Deck\\"] }]
          }
        ]
      }"
`;
  }

  // Stage 1: Initial Load/System Prompt for SUMMARY AGENT (separate agent)
  getSummarySystemPrompt(grouping: GroupingMode): string {
    return `# ROLE: You are a Senior Technical Writer. Your job is to review a list of site observations and improve their titles.

# MISSION:
Your primary mission is to refine the titles of the incoming JSON sections for clarity and professionalism. You are NOT creating a hierarchy or changing the content.

# RULES:
- Your input is a JSON array of "section" objects.
- Your output MUST be a JSON object of the exact same structure, wrapped in \`{"sections": [...]}\`.
- Your final output must be a single, valid JSON object. Do not include any text before or after the JSON.
- You MUST return the same number of sections as you received.
- You MUST preserve the original \`bodyMd\` and \`images\` arrays. Do not alter them.

# TITLE EDITING RULES:
- You have the authority to edit or change any section title that begins with a tilde (~).
- You MUST NOT change a title that does not begin with a tilde, as this indicates it was provided by the user.
- When you are done, you MUST remove the tilde from all titles in the final output.

# OUTPUT FORMAT: JSON ONLY
- The root of the JSON object must be \`{ "sections": [ ... ] }\`.
- Return a flat list of sections. DO NOT nest them.

# EXAMPLE:
- **Input JSON**:
  \`\`\`json
  {
    "sections": [
      {
        "title": "Block 1",
        "bodyMd": ["Site Set-Up"],
        "images": [{ "number": 1, "group": ["Block 1"] }],
        "children": []
      },
      {
        "title": "~Step Falshings",
        "bodyMd": ["Step flashings were being installed in accordance with spec"],
        "images": [{ "number": 2, "group": ["Block 1"] }],
        "children": []
      }
    ]
  }
  \`\`\`

- **Required Output JSON (after title refinement)**:
  \`\`\`json
  {
    "sections": [
       {
        "title": "Block 1",
        "bodyMd": ["Site Set-Up"],
        "images": [{ "number": 1, "group": ["Block 1"] }],
        "children": []
      },
      {
        "title": "Block 1",
        "bodyMd": ["Step flashings were being installed in accordance with spec"],
        "images": [{ "number": 2, "group": ["Block 1"] }],
        "children": []
      }
    ]
  }
  \`\`\`
`;
  }

  //#################################
  //# Stage 2: Runtime/Task Prompt  #
  //#################################
  generateUserPrompt(
    observations: string[],
    specifications: string[],
    sections: Section[],
    grouping: GroupingMode
  ): string {
    const specs =
      specifications.length > 0
        ? `
# RELEVANT SPECIFICATIONS:
${specifications.map((spec) => `- ${spec}`).join('\n')}
`
        : '';

    return `
# INSTRUCTIONS:
- Analyze the following raw observations.
- **Critical** If you generate a title yourself, you MUST prefix it with a tilde (~). For example: "~Gable End Drip Edge Flashing".
- For each observation, generate exactly one section, which can have multiple bodyMd points.
- Return a single JSON object of the form {"sections":[ ... ]} containing one section for each observation, in the same order.

${specs}

# RAW OBSERVATIONS:
${observations.map((obs) => `- ${obs}`).join('\n')}
`;
  }


  // Stage 2: Runtime User Prompt for SUMMARY AGENT
  generateSummaryPrompt(draft: string, context: any, sections: Section[]): string {
    return `# INSTRUCTIONS:
- Take the following array of JSON "section" objects and refine the titles as needed for clarity and grouping.
- Follow the rules I provided in my system prompt. Do not change user-provided titles (those without a ~).
- **Critical** If title is marked with a tilde (~), you can edit the title to improve structure and clarity. IF no tilde, MUST leave the title as is.
- Organize them into a final, structured report with a logical hierarchy, following the rules and format I provided in my system prompt.

# JSON SECTIONS TO ORGANIZE:
\`\`\`json
${JSON.stringify(sections, null, 2)}
\`\`\`
`;
  }
}