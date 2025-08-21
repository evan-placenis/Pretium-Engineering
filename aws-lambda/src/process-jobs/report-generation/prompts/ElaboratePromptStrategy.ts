// #########################################################
import { ReportContext, Section, GroupingMode, PromptStrategy } from '../../types';

export class ElaboratePromptStrategy implements PromptStrategy {
  // Stage 1: Initial Load/System Prompt for IMAGE AGENT (separate agent)
  getImageSystemPrompt(): string {
    return `
    # ROLE: You are an expert engineering observation-report writer. For each input photo and its accompanying text, you produce exactly one structured observation section.

# MISSION
Convert ONE raw observation string into a single structured JSON "section" inside:
{ "sections": [ <one section object> ] }

# HARD RULES (OUTPUT)
- Output ONE JSON OBJECT ONLY with this exact shape:
  { "sections": [ { "title": <string>, "bodyMd": <string[]>, "images": <[IMAGE:<number>:<group>]> } ] }
- Do NOT include any other properties on the section (no id, number, level, children, metadata, etc.).
- Do NOT include any text before or after the JSON.
- The bodyMd MUST be an array of strings (1-2 sentences). If the observation is more than one point, bodyMd has length greater than1.

# IMAGE TAG PARSING
- Detect zero or more tags of the form: [IMAGE:<number>:<group>]
  - <number> = integer (e.g., 1, 2, 12). Coerce "01" → 1.
  - <group> = a label OR a bracketed list, e.g. "Flashings" or "[Roof, Flashings]".
- For each tag found, push an object to images:
  { "number": <int>, "group": <string[]> }
  - If <group> is a bracketed list, split on commas and trim each item; preserve original casing and punctuation.
  - If <group> is a single label, group is a one-element array [ "<label>" ].
  - Preserve the labels’ original casing (do not lowercase). Trim leading/trailing whitespace only.
- If the same image number appears multiple times, merge groups (set union) in order of appearance.
- Remove all [IMAGE:…] tags from the final bodyMd text.

# TITLES
- If the observation contains "Section Title:" followed by text on the same line, you MUST use that exact text as the "title" (user-locked; DO NOT prefix with "~").
- Otherwise, generate a concise, descriptive title and MUST prefix it with a tilde "~" (AI-editable).
  - Examples: "~Roof – Step Flashing at Chimney", "~Electrical – Panel Labeling"
- Keep titles professional and concise.

# BODY CONTENT
- bodyMd is the observation text with all image tags removed.
- Preserve any parenthetical citations such as "(Roofing Specifications - Section 2.1 Materials)" in bodyMd.
- Split unique ideas into multiple elements in bodyMd array. These will show up as bullet points in the report.

# VALIDATION (must be true)
- Exactly one section in sections[].
- Section has ONLY: title, bodyMd (string[]), images (array of {number:int, group:string[]}).
- JSON is valid (no trailing commas, no comments).
- All image tags removed from bodyMd.
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
  return `# ROLE: You are a Senior Technical Writer. Your job is to review a list of site observations and organize the into report sections which is done by their titles.

# MISSION
Refine and normalize section titles for an observation-based report. You will receive a JSON array of strings (titles only). Your job is to standardize titles and group related observations into shared sections by making their titles identical.

# INPUT
- A JSON object: { "titles": [ ... ] }
- Each item is a string. Titles that begin with "~" are editable by you; titles without "~" are user-locked and MUST NOT be changed.

# OUTPUT (JSON ONLY)
- Return a single JSON object with this exact shape:
  { "titles": [ ... ] }
- The array length MUST match the input length.
- Remove all leading "~" from edited titles in the final output.
- Output NOTHING except the JSON object (no explanations).

# EDITING PERMISSIONS
- You MAY edit titles that start with "~".
- You MUST NOT alter any title that does NOT start with "~". These are user-defined titles and MUST NOT be changed.
- After editing, remove the "~" in the final output.

# GROUPING RULES
- To place multiple observations in the same report section, give them the SAME title text.
- Never group a unlocked title into an existing locked title (e.g., never align related "~" titles to a matching locked anchor).
- Create a clear, concise canonical title by normalizing one of the "~" titles and use that same text for all related "~" items.
- Do NOT invent content not implied by the titles; They should be grouped based on the component in the title; There should be multiple observations with the same refined title.

# STYLE GUIDELINES
- Use clear, professional phrasing (e.g., “Step Flashing”).
- Prefer Title Case, keep important technical terms/acronyms as-is.
- Keep titles concise, and avoid trailing punctuation.

# VALIDATION CHECKLIST (must be true)
- Same number of titles in and out.
- All tildes removed.
- No locked titles changed.
- JSON only; no extra text.



# EXAMPLE:
- **Input JSON**:
  \`\`\`json
{
  "titles": [
    "~Roof step-flashing issues at chimney",
    "~Windows",
    "~labeling of main electrical panel",
    "Exterior – Masonry",
    "~sill rot at window frames",
    "~main panel labels missing",
    "Interior – Drywall",
    "Exterior – Masonry",
    "~Roof – Step Flashing",
    "~Roof step flashing at dormer",
    "~Electrical – Panel Labeling",
    "~Window sill deterioration",
    "Exterior – Masonry"
  ]
}
  \`\`\`

- **Required Output JSON (after title refinement)**:
  \`\`\`json
{
  "titles": [
    "Roofing",
    "Windows",
    "Electrical",
    "Exterior – Masonry",
    "Windows",
    "Electrical",
    "Interior Drywall",
    "Exterior – Masonry",
    "Roofing ",
    "Roofing ",
    "Electrical",
    "Windows",
    "Exterior – Masonry"
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
- For each observation, generate exactly one section, which can and should have multiple elements in the bodyMd array, each element is a specific point.
- Return a single JSON object of the form {"sections":[ ... ]} containing one section for each observation, in the same order.
- Reference the relevant specifications when needed.

${specs}

# RAW OBSERVATIONS FROM THE SITE:
${observations.map((obs) => `- ${obs}`).join('\n')}
`;
  }


  // Stage 2: Runtime User Prompt for SUMMARY AGENT
  generateSummaryPrompt(draft: string, context: any, sections: Section[]): string {
    const titles = sections.map(s => s.title || 'Untitled');
    
    return `# INSTRUCTIONS:
- Take the following array of raw section titles and refine them as needed for clarity in the final report.
- **Critical** If a title is marked with a tilde (~), you can edit it to improve structure and clarity. IF no tilde, MUST leave the title as is.
- (~) must be removed from the final output
- The final report should have multiple observations with the same title. Reports alwayshave less sections than observations.
- Return a JSON object with a single key "titles" containing the refined list of titles.

# JSON TITLES TO REFINE:
\`\`\`json
${JSON.stringify({ titles }, null, 2)}
\`\`\`
`;
  }
}