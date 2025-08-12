import { z } from 'zod';

export interface Section {
  id: string;           // Stable UUID
  number: string;       // "1", "1.2", etc.
  title: string;        // "Roofing"
  bodyMd: string;       // Markdown/bullets/text with [IMAGE:x:GROUP] refs
  children: Section[];
}

export interface SectionSummary {
  id: string;
  number: string;
  title: string;
  path: string[];      // Full path to section for disambiguation
  previewText: string; // First ~200 chars
}

// Tool argument schemas
export const ListSectionsSchema = z.object({}).strict();

export const RenameSectionSchema = z.object({
  section_id: z.string(),
  new_title: z.string()
}).strict();

export const SetSectionBodySchema = z.object({
  section_id: z.string(),
  body_md: z.string()
}).strict();

export const InsertSectionSchema = z.object({
  section_id: z.string(), // After this section
  title: z.string(),
  body_md: z.string().optional()
}).strict();

export const DeleteSectionSchema = z.object({
  section_id: z.string()
}).strict();

export const MoveSectionSchema = z.object({
  section_id: z.string(),
  new_parent_id: z.string(),
  position: z.number().optional() // Index in new parent's children
}).strict();

export const FindSectionsSchema = z.object({
  query: z.string()
}).strict();

export const ReplaceTextSchema = z.object({
  section_id: z.string(),
  find: z.string(),
  replace: z.string(),
  flags: z.string().optional() // Regex flags
}).strict();

export const InsertImageRefSchema = z.object({
  section_id: z.string(),
  image_number: z.number(),
  group: z.string().optional()
}).strict();

// Tool response types
export interface ToolResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export interface SectionEditState {
  sections: Section[];
  version: number;      // For tracking changes
  lastModified: string; // ISO timestamp
}
