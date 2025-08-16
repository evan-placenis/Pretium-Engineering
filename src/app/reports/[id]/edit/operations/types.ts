import { Section } from "@/lib/jsonTreeModels/types/section";
export * from "@/lib/jsonTreeModels/types/section";

export interface BaseOperation {
  id: string;          // UUID for the operation
  timestamp: string;   // When it was applied
  version: number;     // Document version when applied
  actor?: string;      // User or system that performed the operation
  reason?: string;     // Why the operation was performed
  toolCallId?: string; // Reference to the AI tool call that triggered this
}

export interface RenameSectionOp extends BaseOperation {
  type: 'rename_section';
  sectionId: string;
  prevTitle: string;
  newTitle: string;
}

export interface SetSectionBodyOp extends BaseOperation {
  type: 'set_section_body';
  sectionId: string;
  prevBody: string;
  newBody: string;
  citations?: Array<{
    source: string;
    page: number;
    text: string;
  }>;
}

export interface InsertSectionOp extends BaseOperation {
  type: 'insert_section';
  afterId: string;     // ID of the section to insert after
  section: Section;    // The new section to insert
}

export interface DeleteSectionOp extends BaseOperation {
  type: 'delete_section';
  section: Section;    // The section being deleted (for undo)
  parentId: string;    // Parent section ID
  index: number;       // Index in parent's children array
}

export interface MoveSectionOp extends BaseOperation {
  type: 'move_section';
  sectionId: string;
  fromParentId: string;
  fromIndex: number;
  toParentId: string;
  toIndex: number;
}

export type Operation = 
  | RenameSectionOp
  | SetSectionBodyOp
  | InsertSectionOp
  | DeleteSectionOp
  | MoveSectionOp;

export interface OperationBatch {
  id: string;
  operations: Operation[];
  timestamp: string;
  version: number;
  actor?: string;
  reason?: string;
}

export interface DocumentSnapshot {
  reportId: string;
  version: number;
  sections: Section[];
  timestamp: string;
}

export interface OperationResult {
  success: boolean;
  operation: Operation;
  error?: string;
  newVersion?: number;
}