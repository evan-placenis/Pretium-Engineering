# Report Structuring Migration Plan

## Background

Currently, reports are generated as plain text with numbered sections (e.g., "1. GENERAL", "1.1 Site Observations"). This text is parsed via regex for display (in ReportEditor.tsx and edit_report_page.tsx) and Word export (in word-utils.ts). Editing uses a structured Section model (via SectionModel.ts and useOperations.ts), but generation and storage remain text-based.

This leads to hardcoded parsing (e.g., regex for "1. " patterns), fragility (e.g., breaking on non-standard text), and inconsistency between generation/display/export and the editing system.

## Goals

Migrate to a fully structured model where reports are JSON trees of Section objects (from operations/types.ts: { id, number, title, bodyMd, children }).

- Generate JSON from AI.
- Store as JSON in Supabase.
- Render/display from JSON.
- Edit via existing operations (already structured).
- Export to Word from JSON.
- Benefits: More flexible, less hardcoded, easier to maintain/search/reorder, consistent across lifecycle.

## Extensibility for Report Types

- Support multiple types (e.g., observation, audit) via top-level "reportType" in JSON and polymorphic sections (extend Section interface with type-specific fields).
- In prompts: Condition on reportType.
- In render/export: Branch on reportType for custom logic.

## Design Patterns

- Use Strategy Pattern for report structures: ReportStructureStrategy interface with getSchema(), autoNumber(), etc.
- Concrete strategies: ObservationReportStrategy (default), BCAReportStrategy (future).
- SectionModel constructor takes strategy for type-specific logic (e.g., validation, numbering).
- Note: For chat editing (route.ts), use default strategy (no type-specific logic needed).

### File Structure

- Interfaces/types: src/lib/types/ (e.g., reportStrategies.ts)
- Concrete strategies: src/lib/strategies/ (e.g., ObservationReportStrategy.ts)
- Core models: src/lib/models/ (e.g., SectionModel.ts)

## Impacts on Original Tasks

1. **Display**: Replace regex parsing with JSON tree traversal (easier, more reliable). Render headers from number/title, body from bodyMd (can be Markdown).
2. **Word Download**: Build docx directly from JSON (no parsing); loop over sections to create numbered paragraphs/tables.
3. **AI Generation**: Update prompts to output JSON arrays matching Section schema (low effort, more structured than Markdown).

## Affected Files/Components

- Generation: aws-lambda/src/process-jobs/report-generation/prompts/\*.ts (e.g., ElaboratePromptStrategy.ts), ReportGenerator.ts, process-jobs/report-job-handler.ts.
- Storage: Add sections_json column to reports table (Supabase schema change); update fetch/save in edit_report_page.tsx, reports_page.tsx.
- Display: reports/[id]/edit/components/ReportEditor.tsx, edit_report_page.tsx (replace processContentWithImages with renderSectionsFromJson).
- Editing: Minimal—useOperations.ts and StructuredReportChat.tsx already use Section model.
- Export: lib/word-utils.ts (update createWordDocumentWithImages to take sections JSON).
- Models: src/app/api/chat/models/SectionModel.ts (enhance if needed for JSON serialization).
- Other: Any API routes calling generation (e.g., api/models/archive/generate-report/route.ts).

## Class-Based JSON Handling

- Extend SectionModel.ts with toJSON() for serialization and fromJSON(json) for parsing/validation (use zod for schema checks).
- Use in generation (parse/validate AI output), storage (serialize before save), and consumers (work with instances).

## Phased Implementation Plan

### Phase 1: Update AI Generation to Output JSON (1-2 hours)

- Modify prompts: Output JSON without "number" field (e.g., { sections: [{ title: "General", bodyMd: "...", children: [...] }] }). Use [IMAGE:1] in bodyMd.
- Update execution strategies (e.g., BatchedParallelExecutor.ts): After LLM, parse with SectionModel.fromJSON(); auto-number with new autoNumberSections() method; stringify valid model.
- Test: Generate a sample report; ensure valid JSON.
- Note: Tune prompts for reliable JSON (strict instructions, examples); add tolerant validation in fromJSON for common AI errors.

### Phase 2: Update Storage for JSON (30-60 min)

- Supabase: Add sections_json jsonb column to reports table (default []).
- Update save functions (e.g., in edit_report_page.tsx saveMarkdown): Save JSON alongside generated_content (for backward compat).
- Fetch: In edit_report_page.tsx and reports_page.tsx, load sections_json if present.
- Note: Autosave may overwrite generated_content if JSON invalid—fixed by fallback in saveMarkdown.
- Note: If raw editor is blank, check autosave - fixed with fallback to old generated_content in saveMarkdown. Disable temporarily by commenting save calls if testing.

### Phase 3: Update Display/Rendering from JSON (1-2 hours)

- In ReportEditor.tsx/edit_report_page.tsx: Add renderSections function that recursively builds HTML: <h1>{section.number} {section.title}</h1> + ReactMarkdown(section.bodyMd) + render children.
- Handle images: Parse [IMAGE:X] in bodyMd to inject <img>.
- Deprecate regex parsing; fallback to old method if sections_json is empty.
- Completed - removed old hardcoded rendering; now purely tree-based from JSON. Test display of new JSON report.
- Note: Rendering is recursive/general based on JSON tree for arbitrary nesting, styled via classes (less hardcoded).
- Note: After changes, fix imports and types (e.g., arrays as never, missing modules) - run npx tsc to check.
- Note: Post-refactor, fix linter errors (imports, types) before testing.

### Phase 4: Ensure Editing Compatibility (Minimal, 30 min)

- Already uses Section model—test syncFromMarkdown parses to sections JSON.
- Update any text-based saves to use JSON.

### Phase 5: Update Word Export from JSON (1-2 hours)

- In word-utils.ts createWordDocumentWithImages: Take sections param; recursively createParagraph for each (use number for leveling, title for heading, parse bodyMd for text/images).
- Build tables/images as before, but from structured data.

### Phase 6: Testing & Migration (Ongoing)

- Unit tests: Generate -> Store -> Render -> Export cycle.
- Migrate existing reports: Script to parse generated_content to sections_json (using SectionModel.fromMarkdown).
- Rollout: Feature flag (e.g., use_structured=true) for new reports.
- Cleanup: Delete deprecated hardcoded parsing/rendering code (e.g., regex-based processContentWithImages in edit_report_page.tsx and ReportEditor.tsx) once new system is confirmed stable.

## Risks and Mitigations

- AI JSON validity: Use JSON mode in LLM calls; add validation/fallback to text.
- Backward compat: Keep generated_content; dual-render (JSON if present, else text).
- Performance: JSON parsing is fast; monitor for large reports.
- Word formatting: Test exports match current output exactly.
- Rollback: Keep old code paths via flags.
- Schema changes: Version JSON schema for future types.

## Timeline Estimate

- Total: 1-2 days (phased over multiple sessions).
- Next Steps: Start with Phase 1 if approved.

For questions, reference conversation history on structured model migration.
