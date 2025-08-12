# Building a Powerful Chatbot-Integrated Report Editing System

This document outlines a robust architecture for integrating a chatbot into a report editing process — similar to how **Cursor** does it — while avoiding the pitfalls of brittle string manipulation.

---

## 1️⃣ Problem With Current Approach
Your current system asks the model to return JSON with edits applied directly to raw report text. This is brittle because:
- The AI must find and replace headers by guessing.
- Formatting can break (especially for image placeholders like `[IMAGE:x]`).
- Large text chunks make the model slower and less accurate.

---

## 2️⃣ Solution: Structured Editing With a Section Model
Instead of editing raw text, **parse the report into a structured data model** that represents sections, titles, and content.

Example:
```ts
interface Section {
  id: string;           // stable UUID
  number: string;       // "1", "1.2", etc.
  title: string;        // "Roofing"
  bodyMd: string;       // markdown text with [IMAGE:x] references
  children: Section[];
}
```

### Why:
- Stable IDs mean the AI can say “edit section `abc123`” instead of “find the heading 1. Roofing”.
- Numbering, formatting, and placeholders are preserved automatically.

---

## 3️⃣ Move to Tool-Based Editing (Function Calling)
Modern LLM APIs (OpenAI, xAI, Anthropic, etc.) support **tools** (function calling).  
Instead of asking for a JSON blob with changes, define explicit **tools** the model can call.

Example core tools:
- `list_sections()` → Returns an outline with IDs and titles.
- `rename_section(section_id, new_title)`
- `set_section_body(section_id, body_md)`
- `insert_section_after(section_id, title, body_md)`
- `delete_section(section_id)`

Optional:
- `find_sections(query)` for semantic search.
- `replace_text(section_id, find, replace)`.

---

## 4️⃣ How the Loop Works
1. **Parse** Markdown/DOCX once into your `Section[]` model.
2. Send user request + system prompt + **tool schema** to the model.
3. If the model calls a tool:
   - Validate and execute it server-side.
   - Apply the change to the Section model.
   - Append a `role: "tool"` message with the tool result.
4. Repeat until the model returns a normal assistant message.
5. Save updated Section model → render Markdown/DOCX.

---

## 5️⃣ Example Flow: Renaming a Header
User: “Rename 1. Roofing to 1. Roof Assembly.”

**The model:**
1. Calls `list_sections()` → sees:
```json
[{ "id": "abc123", "number": "1", "title": "Roofing" }]
```
2. Calls `rename_section({ "section_id": "abc123", "new_title": "Roof Assembly" })`.

**Your code:**
- Updates that section’s title.
- Regenerates numbering and output.

Result: No regex guessing, no broken formatting.

---

## 6️⃣ Why Markdown Parsing Matters
If your reports are in Markdown, you can use **[remark](https://github.com/remarkjs/remark)** to:
- Parse headings into AST nodes (Abstract Syntax Tree).
- Store each heading as a Section.
- Update sections in code.
- Re-stringify back to Markdown.

If using DOCX, parse once → Section model, then export back.

---

## 7️⃣ Benefits of This Approach
- **Reliable** — No “find/replace” guessing.
- **Safe** — Formatting rules enforced in your code.
- **Flexible** — Same tool API works for headings, paragraphs, bullets, images.
- **Efficient** — Only send relevant sections to AI.

---

## 8️⃣ Minimal Example (OpenAI)
```ts
const tools = [
  {
    type: "function",
    function: {
      name: "rename_section",
      description: "Rename a report section.",
      parameters: {
        type: "object",
        properties: {
          section_id: { type: "string" },
          new_title: { type: "string" }
        },
        required: ["section_id", "new_title"]
      }
    }
  }
];

const res = await openai.chat.completions.create({
  model: "gpt-5",
  messages,
  tools,
  tool_choice: "auto"
});
```

---

## 9️⃣ Migration Path
1. Keep your RAG + agent routing logic.
2. Replace “return JSON edits” with **tool-based edits**.
3. Store your report in a structured Section model.
4. Apply edits via tools and re-render.

---

## 10️⃣ Next Steps
- Implement a parser (Markdown or DOCX → Section model).
- Define your core editing tools.
- Wrap your chatbot call in a **tool execution loop**.
- Validate tool arguments strictly (zod/ajv).
- Add undo/version history.

This moves you from a brittle “hope it edits correctly” system to a **Cursor-grade editing engine**.
