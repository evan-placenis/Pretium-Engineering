# AI Assistant Chat API (`/api/chat`) Documentation

This document outlines the architecture and data flow for the AI-powered chat assistant used in the report editor.

## Core Architecture: Stateless & Lazy-Loading

The chat API is designed around a **stateless** and **"lazy-loading"** architecture. This approach is highly robust and cost-effective.

- **Stateless by Default:** Each request to the `/api/chat` endpoint starts with zero context about the report's content or the conversation history. The server does not hold any state between requests.
- **Lazy-Loading via Tools:** The AI assistant is instructed to be "lazy." It only fetches the specific information it needs to fulfill a user's request by using a well-defined set of tools. This includes conversation history - the AI will only fetch previous messages when the user refers to prior context or when asking clarifying questions that require understanding previous exchanges.

---

## AI Tools

The AI has access to two categories of tools, which are managed in `pretium/src/lib/jsonTreeModels/tools/SectionTools.ts`.

### 1. Context-Fetching Tools

These tools allow the AI to gather information on demand.

- `get_report_slices`: Fetches summaries of specific sections of the report. This is the primary tool the AI uses when a user refers to a section by its number or title (e.g., "update section 3.1"). It allows the AI to resolve the section number to a stable UUID before performing an action.
- `get_chat_history`: Retrieves a summary of the recent conversation. The AI is instructed to use this when the user refers to previous messages, when asking clarifying questions that need context from prior exchanges, or when continuing work from previous conversations.
- `search_project_specs`: Searches the project's knowledge base (embeddings) for technical specifications, codes, or requirements.

### 2. Action Tools

These tools perform modifications to the report. They are all stateless and follow a `load -> modify -> save` pattern.

- `update_section`: Modifies the `title` or `bodyMd` of an existing section.
- `add_section`: Adds a new section to the report.
- `move_section`: Moves a section to a new position or parent.
- `delete_section`: Deletes a section and all its children.
- `renumber_sections`: Recalculates and applies all section numbers. The AI is instructed to call this as its final action after any other tool that changes the report's structure (`add`, `move`, `delete`).

---

## Server-Side Logic & Data Flow

1.  **Request:** The frontend sends a JSON payload to `/api/chat` containing only the user's message, the `reportId`, and the `projectId`.
2.  **Heuristic Gate (`ruleGate`):** A simple, fast regex-based check runs on the user's message to determine if it's likely to require technical specifications. This acts as a cost-saving measure by only granting the AI access to the `search_project_specs` tool when necessary.
3.  **Tool Orchestration Loop:** The backend passes the user's message and the list of available tools to the LLM.
    - If the LLM responds with a tool call, the backend executes the corresponding tool function from `SectionTools.ts`.
    - All database operations within the tools use a **Service Role Supabase Client** (`createServiceRoleClient`) to bypass Row Level Security (RLS), which is necessary for the server to read and write data on behalf of the user.
    - The result of the tool call is sent back to the LLM. This loop continues until the LLM responds with a natural language message for the user.
4.  **Response:** The API responds with a JSON object containing the final AI message and, crucially, the `updatedSections` array, which represents the complete, new state of the report after all tool operations have been completed.
5.  **Cache Invalidation:** Immediately after a successful database update, the API calls `revalidateTag()` to invalidate the Next.js cache for the specific report.

---

## The "Silent AI" Problem and the Confirmation Message

A critical aspect of this architecture is how the server knows when to save the final report. The save-and-refresh logic is triggered **only when the API sends a successful final response** containing the AI's natural language message.

This creates a subtle failure case:

- **Single Updates (Work Correctly):** When the AI performs a single action (e.g., `update_section`), it typically follows up with a confirmation message like, "Okay, I've updated that section." This message allows the server to exit its loop gracefully, save the changes, and send the successful response.
- **Batch Updates (Can Fail):** When the AI performs a `batch_update_sections` call, it may consider the entire task complete after the single successful tool call. It often does **not** send a final confirmation message and simply goes silent.

When the AI goes silent, the server's orchestration loop continues until it times out, at which point it returns a `400 Bad Request` error. The in-memory changes are discarded, and the successful response with `updatedSections` is never sent.

**Solution:** The system prompt (`getSystemPrompt()` in `route.ts`) now includes an explicit, critical rule that instructs the AI that it **MUST** send a simple confirmation message after every successful `batch_update_sections` call. This ensures that the batch update workflow mimics the successful single update workflow, triggering the save-and-refresh process reliably.

---

## Frontend UI Updates

1.  **Callback:** The `edit_report_page.tsx` component passes an `onChatComplete` callback function to the `StructuredReportChat` component.
2.  **State Update:** When the `useStructuredChat` hook receives a successful response from the `/api/chat` API, it calls `onChatComplete` with the `updatedSections` data from the response body.
3.  **Re-render:** This triggers the `setSections` state update in `edit_report_page.tsx`, causing the `ReportEditor` component to re-render with the new, updated report data, ensuring the user sees the changes instantly.

<!--

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
  id: string; // stable UUID
  number: string; // "1", "1.2", etc.
  title: string; // "Roofing"
  bodyMd: string; // markdown text with [IMAGE:x] references
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
          new_title: { type: "string" },
        },
        required: ["section_id", "new_title"],
      },
    },
  },
];

const res = await openai.chat.completions.create({
  model: "gpt-5",
  messages,
  tools,
  tool_choice: "auto",
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

## Current Status (As of August 2024)

We're in the process of migrating to a fully structured JSON report model as outlined in `docs/report-structuring-plan.md`.

### Completed

- **Phase 1: Update AI Generation to Output JSON** - AI now outputs JSON sections without numbers (system auto-numbers). Strategy Pattern implemented for extensibility (e.g., ObservationReportStrategy).
- Basic structured display in ReportEditor using recursive rendering and CSS Modules.
- Versioning and operations system integrated with JSON model.

### In Progress / Partial

- **Phase 2: Store Structured JSON in Database** - sections_json column added and populated during generation and polling backfill. However, issues with image signed URLs (400 Bad Request, likely bucket name mismatch 'report_images' vs 'report-images') and polling errors (ReferenceError on newSections, parse failures on non-JSON content causing blank page after initial load).
- Chat integration with structured model, but API calls failing with 500 when sections are empty.

### Known Bugs

- Images not loading (400 on signed URLs) - src shows correct path but request fails.
- Page loads structured content briefly, then blanks to "No structured content available" due to polling parse errors.
- Double dots in numbering (e.g., "2..1") - fixed in SectionModel.
- Text overflowing screen - fixed in CSS.
- Bold bullets - fixed in CSS.
- Chat POST to /api/chat returns 500.

### Next Steps

- Fix signed URL generation (correct bucket name, ensure path stripping).
- Stabilize polling: handle non-JSON content better, fix variable scope in catch.
- Make chat robust to empty sections.
- Complete Phase 3: Update Display to Use JSON Tree.
- Proceed to Phase 4: Update Editing Tools for JSON.
- Cleanup legacy code (Phase 6).

Once these are fixed, the system should be stable for structured reports. -->
