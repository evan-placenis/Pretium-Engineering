import { SectionModel } from '../SectionModel';
import { ObservationReportStrategy } from '@/lib/report_strucutres/strategies/ObservationReportStrategy';
import { createServiceRoleClient } from '@/lib/supabase';
import { Section, SectionSummary } from '../types/section';

type ToolResult = {
    success: boolean;
    data?: any;
    error?: string;
};

// Create a single, reusable admin client instance for this module
const supabaseAdmin = createServiceRoleClient();

// A helper to fetch the report model on-demand for stateless tool operations
async function loadReportModel(reportId: string): Promise<SectionModel> {
    const strategy = new ObservationReportStrategy();
    console.log(`[loadReportModel] Attempting to load report for ID: ${reportId}`);

    const { data: reportData, error: reportError } = await supabaseAdmin
        .from('reports')
        .select('sections_json')
        .eq('id', reportId)
        .maybeSingle();

    if (reportError) {
        // Don't throw on row-not-found, but do throw on other DB errors
        if (!reportError.message.includes('Results contain 0 rows')) {
             throw new Error(`Failed to fetch report: ${reportError.message}`);
        }
    }

    if (reportData?.sections_json) {
        return SectionModel.fromJSON(reportData.sections_json, strategy);
    } else {
        // If no sections exist, create a new empty model.
        return new SectionModel([], strategy);
    }
}

async function saveReportModel(reportId: string, model: SectionModel): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from('reports')
        .update({ sections_json: model.toJSON() })
        .eq('id', reportId);

    if (error) {
        console.error('Failed to save report:', error);
        return false;
    }
    return true;
}

export class SectionTools {
    private reportId: string;
    private projectId: string;
    private strategy: ObservationReportStrategy;
    private model: SectionModel | null = null;

    constructor(reportId: string, projectId: string) {
        this.reportId = reportId;
        this.projectId = projectId;
        this.strategy = new ObservationReportStrategy();
    }

    private async getModelInstance(): Promise<SectionModel> {
        if (this.model === null) {
            this.model = await loadReportModel(this.reportId);
        }
        return this.model;
    }

    // --- Schemas for the new toolset ---
    private getReportSlicesSchema = {
        type: 'object',
        properties: {
          sectionIds: { type: 'array', items: { type: 'string' }, description: 'An array of section IDs to fetch.' },
          query: { type: 'string', description: 'If IDs are unknown, a search query to find relevant sections.' },
          maxChars: { type: 'integer', minimum: 200, maximum: 4000, default: 2000 }
        },
        additionalProperties: false
    };

    private getChatHistorySchema = {
        type: 'object',
        properties: {
            maxTurns: { type: 'integer', minimum: 1, maximum: 20, default: 5 }
        },
        additionalProperties: false
    };

    private updateSchema = {
        type: 'object',
        properties: {
            id: { type: 'string', description: 'The unique ID of the section to update.' },
            title: { type: 'string', description: 'The new title for the section. Can be an empty string.' },
            bodyMd: { type: 'array', items: { type: 'string' }, description: 'The new body content for the section, as an array of Markdown strings.' }
        },
        required: ['id'],
        additionalProperties: false
    };
    private addSchema = {
        type: 'object',
        properties: {
            parentId: { type: ['string', 'null'], description: 'The ID of the parent section. Use null for a root-level section.' },
            title: { type: 'string', description: 'The title for the new section.' },
            bodyMd: { type: 'array', items: { type: 'string' }, description: 'The body content for the new section.' },
            position: { type: 'number', description: 'The 0-based index to insert the new section at. If omitted, adds to the end.' }
        },
        required: ['parentId', 'title'],
        additionalProperties: false
    };
    private moveSchema = {
        type: 'object',
        properties: {
            sectionId: { type: 'string', description: 'The ID of the section to move.' },
            newParentId: { type: ['string', 'null'], description: 'The ID of the new parent section. Use null to move to the root.' },
            position: { type: 'number', description: 'The 0-based index to move the section to.' }
        },
        required: ['sectionId', 'newParentId', 'position'],
        additionalProperties: false
    };
    private deleteSchema = {
        type: 'object',
        properties: { sectionId: { type: 'string', description: 'The ID of the section to delete.' } },
        required: ['sectionId'],
        additionalProperties: false
    };
    private renumberSchema = { type: 'object', properties: {}, additionalProperties: false };


    // --- Context-Fetching Tools ---
    async getReportSlices({ sectionIds, query, maxChars }: { sectionIds?: string[], query?: string, maxChars?: number }): Promise<ToolResult> {
        const model = await this.getModelInstance();
        let sections: SectionSummary[] = [];

        if (sectionIds) {
            sections = sectionIds.map(id => model.findSectionSummary(id)).filter(Boolean) as SectionSummary[];
        } else if (query) {
            sections = model.findSections(query);
        } else {
            sections = model.listSections(); // Default to summary if no specifics
        }

        let content = JSON.stringify(sections, null, 2);
        if (maxChars && content.length > maxChars) {
            content = content.substring(0, maxChars) + '... (truncated)';
        }
        
        return { success: true, data: content };
    }

    async getChatHistory({ maxTurns }: { maxTurns?: number }): Promise<ToolResult> {
        const { data, error } = await supabaseAdmin
            .from('chat_messages')
            .select('role, content')
            .eq('report_id', this.reportId)
            .order('created_at', { ascending: false })
            .limit(maxTurns || 5);

        if (error) {
            return { success: false, error: 'Failed to fetch chat history.' };
        }
        return { success: true, data: data.reverse() }; // Chronological order
    }

    // --- Stateless Action Tools ---
    async update(id: string, title: string | undefined, bodyMd: string[] | undefined): Promise<ToolResult> {
        const model = await this.getModelInstance();
        let result = false;
        if (title !== undefined) {
            result = model.renameSection(id, title);
            if (!result) return { success: false, error: `Update failed: Could not rename section ${id}.` };
        }
        if (bodyMd !== undefined) {
            result = model.setSectionBody(id, bodyMd);
            if (!result) return { success: false, error: `Update failed: Could not set body for section ${id}.` };
        }

        if (title === undefined && bodyMd === undefined) {
            return { success: false, error: 'Update failed: You must provide a title or bodyMd to update.' };
        }
        
        const saveSuccess = await saveReportModel(this.reportId, model);
        return { success: saveSuccess, data: saveSuccess ? 'Update successful.' : 'Failed to save update.' };
    }

    async add(parentId: string | null, title: string, bodyMd: string[] = [], position?: number): Promise<ToolResult> {
        const model = await this.getModelInstance();
        const newSectionId = model.addSection(parentId, { title, bodyMd }, position);
        if (!newSectionId) {
            return { success: false, error: `Failed to add section. Parent with ID '${parentId}' may not exist.` };
        }
        const saveSuccess = await saveReportModel(this.reportId, model);
        return { success: saveSuccess, data: saveSuccess ? 'Add successful.' : 'Failed to save new section.' };
    }
    
    async move(sectionId: string, newParentId: string | null, position: number): Promise<ToolResult> {
        const model = await this.getModelInstance();
        const moveSuccess = model.moveSection(sectionId, newParentId, position);
        if(!moveSuccess) return { success: false, error: 'Move operation failed.' };
        const saveSuccess = await saveReportModel(this.reportId, model);
        return { success: saveSuccess, data: saveSuccess ? 'Move successful.' : 'Failed to save move.' };
    }
    
    async delete(sectionId: string): Promise<ToolResult> {
        const model = await this.getModelInstance();
        const deleteSuccess = model.deleteSection(sectionId);
        if(!deleteSuccess) return { success: false, error: 'Delete operation failed.' };
        const saveSuccess = await saveReportModel(this.reportId, model);
        return { success: saveSuccess, data: saveSuccess ? 'Delete successful.' : 'Failed to save deletion.' };
    }

    async renumber(): Promise<ToolResult> {
        const model = await this.getModelInstance();
        model.autoNumberSections();
        const saveSuccess = await saveReportModel(this.reportId, model);
        return { success: saveSuccess, data: saveSuccess ? 'Renumbering successful.' : 'Failed to save renumbering.' };
    }

    // Helper to get the model for the final response
    async getFinalModel(): Promise<SectionModel> {
        return await this.getModelInstance();
    }
    
    getContextTools() {
        return [
            {
                type: 'function' as const,
                function: {
                    name: 'get_report_slices',
                    description: 'Fetch a slice of the report, including sections and their summaries, based on IDs or a search query.',
                    parameters: this.getReportSlicesSchema,
                    handler: (args: any) => this.getReportSlices(args),
                },
            },
            {
                type: 'function' as const,
                function: {
                    name: 'get_chat_history',
                    description: 'Retrieve the chat history for the current report, including role and content.',
                    parameters: this.getChatHistorySchema,
                    handler: (args: any) => this.getChatHistory(args),
                },
            },
        ];
    }

    getActionTools() {
        return [
             {
              type: 'function' as const,
              function: {
                name: 'update_section',
                description: 'Update the title or body of a specific section.',
                parameters: this.updateSchema,
                handler: (args: any) => this.update(args.id, args.title, args.bodyMd),
              },
            },
            {
              type: 'function' as const,
              function: {
                name: 'add_section',
                description: 'Add a new section to the report, either at the root or as a child of another section.',
                parameters: this.addSchema,
                handler: (args: any) => this.add(args.parentId, args.title, args.bodyMd, args.position),
              },
            },
            {
              type: 'function' as const,
              function: {
                name: 'move_section',
                description: 'Move a section to a new parent and/or a new position within the report.',
                parameters: this.moveSchema,
                handler: (args: any) => this.move(args.sectionId, args.newParentId, args.position),
              },
            },
            {
              type: 'function' as const,
              function: {
                name: 'delete_section',
                description: 'Delete a section and all its children from the report.',
                parameters: this.deleteSchema,
                handler: (args: any) => this.delete(args.sectionId),
              },
            },
            {
              type: 'function' as const,
              function: {
                name: 'renumber_sections',
                description: 'Recalculates and updates all section numbers. Should be called after any add, move, or delete operation.',
                parameters: this.renumberSchema,
                handler: () => this.renumber(),
              },
            },
        ];
    }
}
