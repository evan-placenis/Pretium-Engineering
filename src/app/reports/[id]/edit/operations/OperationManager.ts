import { v4 as uuidv4 } from 'uuid';
import { Section } from '../types/section';
import {
  Operation,
  OperationResult,
  OperationBatch,
  DocumentSnapshot,
  RenameSectionOp,
  SetSectionBodyOp,
  InsertSectionOp,
  DeleteSectionOp,
  MoveSectionOp
} from './types';

export class OperationManager {
  private sections: Section[];
  private version: number;
  private operations: Operation[];
  private snapshots: DocumentSnapshot[];
  private snapshotInterval: number;

  constructor(
    initialSections: Section[],
    initialVersion: number = 1,
    snapshotInterval: number = 50
  ) {
    this.sections = initialSections;
    this.version = initialVersion;
    this.operations = [];
    this.snapshots = [];
    this.snapshotInterval = snapshotInterval;
  }

  /**
   * Create a new operation with default metadata
   */
  private createOperation<T extends Operation>(
    type: T['type'],
    data: Omit<T, keyof Operation>
  ): T {
    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      version: this.version,
      type,
      ...data
    } as T;
  }

  /**
   * Find a section by its ID
   */
  private findSection(sections: Section[], id: string): Section | null {
    for (const section of sections) {
      if (section.id === id) return section;
      const found = this.findSection(section.children, id);
      if (found) return found;
    }
    return null;
  }

  /**
   * Find a section's parent
   */
  private findParent(sections: Section[], childId: string): { parent: Section, index: number } | null {
    for (const section of sections) {
      for (let i = 0; i < section.children.length; i++) {
        if (section.children[i].id === childId) {
          return { parent: section, index: i };
        }
      }
      const found = this.findParent(section.children, childId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Create a snapshot of the current state
   */
  private createSnapshot(): DocumentSnapshot {
    return {
      reportId: 'report-id', // TODO: Make this configurable
      version: this.version,
      sections: JSON.parse(JSON.stringify(this.sections)), // Deep clone
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Apply an operation to the document
   */
  async applyOperation(operation: Operation): Promise<OperationResult> {
    try {
      switch (operation.type) {
        case 'rename_section': {
          const section = this.findSection(this.sections, operation.sectionId);
          if (!section) {
            return { success: false, operation, error: 'Section not found' };
          }
          section.title = operation.newTitle;
          break;
        }

        case 'set_section_body': {
          const section = this.findSection(this.sections, operation.sectionId);
          if (!section) {
            return { success: false, operation, error: 'Section not found' };
          }
          section.bodyMd = operation.newBody;
          break;
        }

        case 'insert_section': {
          const afterSection = this.findSection(this.sections, operation.afterId);
          if (!afterSection) {
            return { success: false, operation, error: 'Target section not found' };
          }
          const parent = this.findParent(this.sections, afterSection.id);
          if (!parent) {
            return { success: false, operation, error: 'Parent section not found' };
          }
          const index = parent.index + 1;
          parent.parent.children.splice(index, 0, operation.section);
          break;
        }

        case 'delete_section': {
          const parent = this.findParent(this.sections, operation.section.id);
          if (!parent) {
            return { success: false, operation, error: 'Section not found' };
          }
          parent.parent.children.splice(parent.index, 1);
          break;
        }

        case 'move_section': {
          const section = this.findSection(this.sections, operation.sectionId);
          if (!section) {
            return { success: false, operation, error: 'Section not found' };
          }
          const fromParent = this.findParent(this.sections, operation.sectionId);
          if (!fromParent) {
            return { success: false, operation, error: 'Source parent not found' };
          }
          const toParent = this.findSection(this.sections, operation.toParentId);
          if (!toParent) {
            return { success: false, operation, error: 'Target parent not found' };
          }
          // Remove from old position
          fromParent.parent.children.splice(fromParent.index, 1);
          // Insert at new position
          toParent.children.splice(operation.toIndex, 0, section);
          break;
        }
      }

      // Update version and store operation
      this.version++;
      this.operations.push(operation);

      // Create snapshot if needed
      if (this.version % this.snapshotInterval === 0) {
        this.snapshots.push(this.createSnapshot());
      }

      return {
        success: true,
        operation,
        newVersion: this.version
      };
    } catch (error) {
      return {
        success: false,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create the inverse of an operation
   */
  invertOperation(operation: Operation): Operation {
    switch (operation.type) {
      case 'rename_section':
        return this.createOperation('rename_section', {
          sectionId: operation.sectionId,
          prevTitle: operation.newTitle,
          newTitle: operation.prevTitle
        });

      case 'set_section_body':
        return this.createOperation('set_section_body', {
          sectionId: operation.sectionId,
          prevBody: operation.newBody,
          newBody: operation.prevBody,
          citations: operation.citations
        });

      case 'insert_section':
        const parent = this.findParent(this.sections, operation.section.id);
        if (!parent) throw new Error('Section not found');
        return this.createOperation('delete_section', {
          section: operation.section,
          parentId: parent.parent.id,
          index: parent.index
        });

      case 'delete_section':
        return this.createOperation('insert_section', {
          afterId: operation.parentId,
          section: operation.section
        });

      case 'move_section':
        return this.createOperation('move_section', {
          sectionId: operation.sectionId,
          fromParentId: operation.toParentId,
          fromIndex: operation.toIndex,
          toParentId: operation.fromParentId,
          toIndex: operation.fromIndex
        });
    }
  }

  /**
   * Undo the last operation
   */
  async undo(): Promise<OperationResult | null> {
    const lastOp = this.operations[this.operations.length - 1];
    if (!lastOp) return null;

    const inverseOp = this.invertOperation(lastOp);
    const result = await this.applyOperation(inverseOp);
    
    if (result.success) {
      this.operations.pop(); // Remove the undone operation
    }

    return result;
  }

  /**
   * Get the current document state
   */
  getState() {
    return {
      sections: this.sections,
      version: this.version
    };
  }

  /**
   * Get operation history
   */
  getHistory() {
    return this.operations;
  }
}
