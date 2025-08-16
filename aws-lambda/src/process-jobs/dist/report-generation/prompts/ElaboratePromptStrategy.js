"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElaboratePromptStrategy = void 0;
class ElaboratePromptStrategy {
    // Stage 1: Initial Load/System Prompt for IMAGE AGENT (separate agent)
    getImageSystemPrompt() {
        return `# ROLE: You are a highly-detailed technical writer parsing site observations for an engineering report.

# MISSION:
Your primary mission is to convert a single raw text observation into a structured, highly-detailed JSON "section" object. You should elaborate on the provided text, adding technical detail and context where appropriate, based on the input.

# RULES:
- **CRITICAL**: Your output MUST be a single JSON object wrapped in \`{"sections": [...]}\`.
- Parse any image reference tag (e.g., \`[IMAGE:1:Flashings]\`) from the observation text.
- Create a JSON object in the \`images\` array for each tag found (e.g., \`{ "number": 1, "group": "Flashings" }\`).
- **CRITICAL**: After parsing, you MUST remove the image reference tag from the final \`bodyMd\` text. The \`bodyMd\` should only contain the descriptive observation.
- Generate a detailed, descriptive title for the section.
- The \`children\` array should always be empty \`[]\`.
- Only extract one section per observation. The output array \`sections\` should only ever contain one object.

# OUTPUT FORMAT: JSON ONLY
- Do not start with "=== Group name ==="
- Output ONLY a valid JSON OBJECT - must be \`{ "sections": [ ... one section ... ] }\`.
- ALWAYS wrap the array in \`{ "sections": ... }\` - do not output a bare \`[...]\` or it will fail.

# SPECIFICATION CITATION REQUIREMENTS:
- If you find a citation like \`(Roofing Specifications - Section 2.1 Materials)\`, you MUST include it in the \`bodyMd\`.

# EXAMPLES:

1.  **Input**:
    - **Observation**: \`"Metal drip edge flashings at the top of the gable are to be neatly mitered and contain no gaps, as specified in Roofing Specifications - Section 2.1 Materials. [IMAGE:1:Flashings]"\`
    - **Output**:
      \`\`\`json
      {
        "sections": [
          {
            "title": "Gable End Drip Edge Flashing Installation and Compliance",
            "bodyMd": "A detailed review of the metal drip edge flashings at the apex of the gable ends was conducted. The flashings were observed to be precisely mitered, forming a clean, weather-tight seal with no visible gaps. This installation complies with the requirements outlined in Roofing Specifications - Section 2.1 Materials.",
            "images": [{ "number": 1, "group": "Flashings" }],
            "children": []
          }
        ]
      }
      \`\`\`

2.  **Input**:
    - **Observation**: \`"Plywood sheathing replacement is to have a minimum span across three (3) roof trusses. Where tongue and groove plywood is not utilized, metal H-clips must be implemented to provide edge support between roof trusses as per specifications. [IMAGE:3:Roof Deck]"\`
    - **Output**:
      \`\`\`json
      {
        "sections": [
          {
            "title": "Structural Integrity of Roof Deck Replacement and Support Systems",
            "bodyMd": "The replacement of plywood sheathing was inspected to ensure structural requirements were met. It was confirmed that each panel spans a minimum of three roof trusses, providing adequate load distribution. In areas where tongue and groove plywood was not used, metal H-clips have been correctly installed to provide the necessary edge support between trusses, adhering to the project's structural specifications.",
            "images": [{ "number": 3, "group": "Roof Deck" }],
            "children": []
          }
        ]
      }
      \`\`\`
`;
    }
    // Stage 1: Initial Load/System Prompt for SUMMARY AGENT (separate agent)
    getSummarySystemPrompt(grouping) {
        const commonRules = `
# RULES:
- Your input is a JSON array of "section" objects.
- Your output MUST be a single JSON object, wrapped in \`{ "sections": [...] }\`.
- Place the original sections from the input as \`children\` under the appropriate new parent sections.
- **CRITICAL**: You MUST preserve the original \`title\`, \`bodyMd\`, and \`images\` arrays from the input sections. Do not alter them in any way.
- **DO NOT** add numbers to any sections. The system will handle numbering automatically.
- Your final output must be a single, valid JSON object. Do not include any text before or after the JSON.

# OUTPUT FORMAT: JSON ONLY
- The root of the JSON object must be \`{ "sections": [ ... ] }\`.
- Each new parent section you create should have a \`title\`, an empty \`bodyMd\`, an empty \`images\` array, and a \`children\` array containing the original sections you have grouped there.
`;
        if (grouping === 'grouped') {
            return `# ROLE: You are a Senior Technical Writer. Your job is to take a list of pre-formatted JSON "section" objects and organize them into a final report, grouping them based on a pre-defined "group" property.

# MISSION:
Your primary mission is to group the incoming sections based on the \`group\` property found within each section's \`images\` array.

${commonRules}

# GROUPING-SPECIFIC RULES:
- Create new parent sections using the exact \`group\` name from the sections' image references. For example, all sections with an image reference like \`{"number": 1, "group": "Flashings"}\` must be placed under a new parent section titled "Flashings".
- If a section has no \`group\` property, place it under a parent section titled "General Observations".

# EXAMPLE (Grouped Mode):
- **Input JSON**:
  \`\`\`json
  [
    { "title": "...", "bodyMd": "...", "images": [{ "number": 1, "group": "Flashing" }], "children": [] },
    { "title": "...", "bodyMd": "...", "images": [{ "number": 2, "group": "Roof Deck" }], "children": [] },
    { "title": "...", "bodyMd": "...", "images": [{ "number": 3, "group": "Flashing" }], "children": [] }
  ]
  \`\`\`
- **Required Output JSON**:
  \`\`\`json
  {
    "sections": [
      {
        "title": "Flashing",
        "bodyMd": "", "images": [],
        "children": [
          { "title": "...", "bodyMd": "...", "images": [{ "number": 1, "group": "Flashing" }], "children": [] },
          { "title": "...", "bodyMd": "...", "images": [{ "number": 3, "group": "Flashing" }], "children": [] }
        ]
      },
      {
        "title": "Roof Deck",
        "bodyMd": "", "images": [],
        "children": [
          { "title": "...", "bodyMd": "...", "images": [{ "number": 2, "group": "Roof Deck" }], "children": [] }
        ]
      }
    ]
  }
  \`\`\`
`;
        }
        else { // ungrouped
            return `# ROLE: You are a Senior Technical Writer. Your job is to take a list of pre-formatted JSON "section" objects and logically organize them into a final, structured report.

# MISSION:
Your primary mission is to intelligently group the incoming sections based on their content and titles, as there are no pre-defined groups.

${commonRules}

# UNGROUPED-SPECIFIC RULES:
- Analyze the \`title\` and \`bodyMd\` of each section to understand its content.
- Create new, general parent sections that logically categorize the content (e.g., "General Site Conditions", "Structural Observations", "Safety Concerns").
- Do not simply use the title of a child section as a parent section title. The parent section should represent a broader category.

# EXAMPLE (Ungrouped Mode):
- **Input JSON**:
  \`\`\`json
  [
    { "title": "Damaged Insulation", "bodyMd": "Insulation in attic is torn.", "images": [], "children": [] },
    { "title": "Flashing at Eaves", "bodyMd": "Step flashing is correctly installed.", "images": [], "children": [] },
    { "title": "Exposed Wiring", "bodyMd": "Live wires exposed near the main panel.", "images": [], "children": [] }
  ]
  \`\`\`
- **Required Output JSON**:
  \`\`\`json
  {
    "sections": [
      {
        "title": "Building Envelope",
        "bodyMd": "", "images": [],
        "children": [
          { "title": "Damaged Insulation", "bodyMd": "Insulation in attic is torn.", "images": [], "children": [] },
          { "title": "Flashing at Eaves", "bodyMd": "Step flashing is correctly installed.", "images": [], "children": [] }
        ]
      },
      {
        "title": "Safety Observations",
        "bodyMd": "", "images": [],
        "children": [
          { "title": "Exposed Wiring", "bodyMd": "Live wires exposed near the main panel.", "images": [], "children": [] }
        ]
      }
    ]
  }
  \`\`\`
`;
        }
    }
    // Stage 2: Runtime User Prompt for IMAGE ANALYSIS AGENT
    generateUserPrompt(observations, specifications, sections, grouping) {
        const specs = specifications.length > 0
            ? `
# RELEVANT SPECIFICATIONS:
${specifications.map((spec) => `- ${spec}`).join('\n')}
`
            : '';
        return `
# INSTRUCTIONS:
- Analyze the following raw observations.
- For each one, create a structured and detailed JSON "section" object following the rules and format I provided in my system prompt.
- Return a single JSON array containing all of the generated section objects.

${specs}

# RAW OBSERVATIONS:
${observations.map((obs) => `- ${obs}`).join('\n')}
`;
    }
    // Stage 2: Runtime User Prompt for SUMMARY AGENT
    generateSummaryPrompt(draft, context, sections) {
        return `# INSTRUCTIONS:
- Take the following array of JSON "section" objects.
- Organize them into a final, structured report with a logical hierarchy, following the rules and format I provided in my system prompt.
- Create new parent sections to group related observations.

# JSON SECTIONS TO ORGANIZE:
\`\`\`json
${JSON.stringify(sections, null, 2)}
\`\`\`
`;
    }
}
exports.ElaboratePromptStrategy = ElaboratePromptStrategy;
//# sourceMappingURL=ElaboratePromptStrategy.js.map