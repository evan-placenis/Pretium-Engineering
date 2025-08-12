import { z } from 'zod';
import { SectionModel } from '../models/SectionModel';
import {
  ListSectionsSchema,
  RenameSectionSchema,
  SetSectionBodySchema,
  InsertSectionSchema,
  DeleteSectionSchema,
  MoveSectionSchema,
  FindSectionsSchema,
  ReplaceTextSchema,
  InsertImageRefSchema,
  ToolResponse
} from '../types/section';

export class SectionTools {
  private model: SectionModel;
  
  constructor(model: SectionModel) {
    this.model = model;
  }

  async applyTool(name: string, args: unknown): Promise<ToolResponse> {
    try {
      switch (name) {
        case 'list_sections':
          return this.listSections(args);
        case 'rename_section':
          return this.renameSection(args);
        case 'set_section_body':
          return this.setSectionBody(args);
        case 'insert_section':
          return this.insertSection(args);
        case 'delete_section':
          return this.deleteSection(args);
        case 'move_section':
          return this.moveSection(args);
        case 'find_sections':
          return this.findSections(args);
        case 'replace_text':
          return this.replaceText(args);
        case 'insert_image_ref':
          return this.insertImageRef(args);
        default:
          return {
            success: false,
            message: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private listSections(args: unknown): ToolResponse {
    ListSectionsSchema.parse(args);
    const sections = this.model.listSections();
    return {
      success: true,
      data: sections,
      message: sections.map(s => 
        `${s.number}. ${s.title} (id: ${s.id})`
      ).join('\n')
    };
  }

  private renameSection(args: unknown): ToolResponse {
    const { section_id, new_title } = RenameSectionSchema.parse(args);
    const success = this.model.renameSection(section_id, new_title);
    return {
      success,
      message: success ? 'Section renamed' : 'Section not found'
    };
  }

  private setSectionBody(args: unknown): ToolResponse {
    const { section_id, body_md } = SetSectionBodySchema.parse(args);
    const success = this.model.setSectionBody(section_id, body_md);
    return {
      success,
      message: success ? 'Section body updated' : 'Section not found'
    };
  }

  private insertSection(args: unknown): ToolResponse {
    const { section_id, title, body_md } = InsertSectionSchema.parse(args);
    const newId = this.model.insertSection(section_id, title, body_md);
    return {
      success: !!newId,
      message: newId ? 'Section inserted' : 'Target section not found',
      data: newId ? { id: newId } : undefined
    };
  }

  private deleteSection(args: unknown): ToolResponse {
    const { section_id } = DeleteSectionSchema.parse(args);
    const success = this.model.deleteSection(section_id);
    return {
      success,
      message: success ? 'Section deleted' : 'Section not found'
    };
  }

  private moveSection(args: unknown): ToolResponse {
    const { section_id, new_parent_id, position } = MoveSectionSchema.parse(args);
    const success = this.model.moveSection(section_id, new_parent_id, position);
    return {
      success,
      message: success ? 'Section moved' : 'Section or target not found'
    };
  }

  private findSections(args: unknown): ToolResponse {
    const { query } = FindSectionsSchema.parse(args);
    return {
      success: true,
      data: this.model.findSections(query)
    };
  }

  private replaceText(args: unknown): ToolResponse {
    const { section_id, find, replace, flags } = ReplaceTextSchema.parse(args);
    const success = this.model.replaceText(section_id, find, replace, flags);
    return {
      success,
      message: success ? 'Text replaced' : 'Section not found or invalid regex'
    };
  }

  private insertImageRef(args: unknown): ToolResponse {
    const { section_id, image_number, group } = InsertImageRefSchema.parse(args);
    const success = this.model.insertImageRef(section_id, image_number, group);
    return {
      success,
      message: success ? 'Image reference inserted' : 'Section not found'
    };
  }
}
