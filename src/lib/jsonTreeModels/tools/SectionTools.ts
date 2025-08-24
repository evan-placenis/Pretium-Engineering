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

export class SectionTools {
    private reportId: string;
    private projectId: string;
    private model: SectionModel; // Model is now passed in and required

    constructor(reportId: string, projectId: string, model: SectionModel) {
        this.reportId = reportId;
        this.projectId = projectId;
        this.model = model; // The model is now stateful for the request

        // Bind 'this' for all tool methods to prevent context issues
        this.getReportSlices = this.getReportSlices.bind(this);
        this.getChatHistory = this.getChatHistory.bind(this);
        this.update = this.update.bind(this);
        this.add = this.add.bind(this);
        this.move = this.move.bind(this);
        this.delete = this.delete.bind(this);
        this.renumber = this.renumber.bind(this);
        this.getImageMap = this.getImageMap.bind(this);
        this.swapPhotos = this.swapPhotos.bind(this);
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
            bodyMd: { type: 'array', items: { type: 'string' }, description: 'The new body content for the section, as an array of Markdown strings.' },
            images: { 
                type: 'array', 
                items: { 
                    type: 'object',
                    properties: {
                        number: { type: 'number', description: 'The image number reference.' },
                        group: { type: 'array', items: { type: 'string' }, description: 'Optional list of image group labels.' }
                    },
                    required: ['number']
                },
                description: 'The images array for the section.' 
            }
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
    
    private getImageMapSchema = {
        type: 'object',
        properties: {},
        additionalProperties: false
    };

    private swapPhotosSchema = {
        type: 'object',
        properties: {
            imageNumber1: { type: 'number', description: 'The sequential dummy number of the first image (e.g., 1, 2, 3...)' },
            imageNumber2: { type: 'number', description: 'The sequential dummy number of the second image (e.g., 1, 2, 3...)' }
        },
        required: ['imageNumber1', 'imageNumber2'],
        additionalProperties: false
    };


    // --- Context-Fetching Tools ---
    async getReportSlices({ sectionIds, query, maxChars }: { sectionIds?: string[], query?: string, maxChars?: number }): Promise<ToolResult> {
        const model = this.model;
        let sections: SectionSummary[] = [];

        if (sectionIds) {
            sections = sectionIds.map(id => model.findSectionSummary(id)).filter(Boolean) as SectionSummary[];
        } else if (query) {
            sections = model.findSections(query);
        } else {
            sections = model.listSections(); // Default to summary if no specifics
        }

        let payload = { sections, truncated: false };
        if (maxChars && JSON.stringify(payload).length > maxChars) {
            // Fall back to summaries only, or slice the array by items, not characters.
            const slim = sections.slice(0, Math.max(1, Math.floor(sections.length * 0.5)));
            payload = { sections: slim, truncated: true };
        }
        
        return { success: true, data: payload };
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

    // --- In-Memory Action Tools ---
    async update(id: string, title: string | undefined, bodyMd: string[] | undefined, images?: any[]): Promise<ToolResult> {
        // Add UUID validation right at the start of the tool.
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(id)) {
            return { 
                success: false, 
                error: `Invalid ID format: "${id}". You MUST provide a valid UUID. Call get_report_slices to find the correct UUID for the section.` 
            };
        }
        
        const model = this.model;
        let result = false;
        
        // Handle images updates by directly modifying the section
        if (images !== undefined) {
            const allSections = model.getState().sections;
            const sectionsCopy = JSON.parse(JSON.stringify(allSections));
            
            const findAndUpdateSection = (sectionList: Section[], sectionId: string): boolean => {
                for (const section of sectionList) {
                    if (section.id === sectionId) {
                        section.images = images;
                        return true;
                    }
                    if (section.children && findAndUpdateSection(section.children, sectionId)) {
                        return true;
                    }
                }
                return false;
            };
            
            if (!findAndUpdateSection(sectionsCopy, id)) {
                return { success: false, error: `Update failed: Could not find section ${id} to update images.` };
            }
            
            model.setState(sectionsCopy);
            result = true;
        }
        
        if (title !== undefined) {
            result = model.renameSection(id, title);
            if (!result) return { success: false, error: `Update failed: Could not rename section ${id}.` };
        }
        if (bodyMd !== undefined) {
            result = model.setSectionBody(id, bodyMd);
            if (!result) return { success: false, error: `Update failed: Could not set body for section ${id}.` };
        }

        if (title === undefined && bodyMd === undefined && images === undefined) {
            return { success: false, error: 'Update failed: You must provide a title, bodyMd, or images to update.' };
        }
        
        return { success: true, data: 'Update successful.' };
    }

    async add(parentId: string | null, title: string, bodyMd: string[] = [], position?: number): Promise<ToolResult> {
        
        const model = this.model;
        const newSectionId = model.addSection(parentId, { title, bodyMd }, position);
        if (!newSectionId) {
            return { success: false, error: `Failed to add section. Parent with ID '${parentId}' may not exist.` };
        }
        return { success: true, data: 'Add successful.' };
    }
    
    async move(sectionId: string, newParentId: string | null, position: number): Promise<ToolResult> {
        const model = this.model;
        const moveSuccess = model.moveSection(sectionId, newParentId, position);
        if(!moveSuccess) return { success: false, error: 'Move operation failed.' };
        return { success: true, data: 'Move successful.' };
    }
    
    async delete(sectionId: string): Promise<ToolResult> {
        const model = this.model;
        const deleteSuccess = model.deleteSection(sectionId);
        if(!deleteSuccess) return { success: false, error: 'Delete operation failed.' };
        return { success: true, data: 'Delete successful.' };
    }

    async renumber(): Promise<ToolResult> {
        const model = this.model;
        model.autoNumberSections();
        return { success: true, data: 'Renumbering successful.' };
    }

    async batch_update_sections(args: { operations: { type: string, [key: string]: any }[] }): Promise<{ success: boolean; data?: any; error?: string }> {
        // Stage 0: Create a deep clone of the model to work on.
        const clonedModel = this.model.clone();
        const tempIdMap = new Map<string, string>();

        try {
            // Stage 1: Validate all operations before applying any of them.
            console.log("[Tool Debug] Received batch operations:", JSON.stringify(args.operations, null, 2));
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

            for (const op of args.operations) {
                const payload = op; // Use the operation object directly as the payload
                switch (op.type) {
                    case 'update':
                    case 'delete':
                        if (!payload.id || !uuidRegex.test(payload.id)) {
                            throw new Error(`Validation failed: The provided ID "${payload.id}" is not a valid UUID. You MUST use the stable UUID for sections. First, call get_report_slices to find the correct UUID for the section you want to modify.`);
                        }
                        if (!clonedModel.findSectionById(clonedModel.getState().sections, payload.id)) {
                            const availableIds = clonedModel.listSections().map(s => s.id);
                            throw new Error(`Validation failed: Section with ID "${payload.id}" not found for update/delete. Available IDs are: [${availableIds.join(', ')}]`);
                        }
                        break;
                    case 'move':
                        if (!payload.sectionId || !uuidRegex.test(payload.sectionId)) {
                            throw new Error(`Validation failed: The provided sectionId "${payload.sectionId}" is not a valid UUID. You MUST use the stable UUID. Call get_report_slices first.`);
                        }
                        if (payload.newParentId && !uuidRegex.test(payload.newParentId)) {
                            throw new Error(`Validation failed: The provided newParentId "${payload.newParentId}" is not a valid UUID. You MUST use the stable UUID. Call get_report_slices first.`);
                        }
                        const sectionToMove = clonedModel.findSectionById(clonedModel.getState().sections, payload.sectionId);
                        if (!sectionToMove) {
                            const availableIds = clonedModel.listSections().map(s => s.id);
                            throw new Error(`Validation failed: Section with ID "${payload.sectionId}" not found for move. Available IDs are: [${availableIds.join(', ')}]`);
                        }
                        if (payload.newParentId && !clonedModel.findSectionById(clonedModel.getState().sections, payload.newParentId)) {
                            const availableIds = clonedModel.listSections().map(s => s.id);
                            throw new Error(`Validation failed: New parent with ID "${payload.newParentId}" not found. Available IDs are: [${availableIds.join(', ')}]`);
                        }
                        if (payload.newParentId && clonedModel.isDescendant(payload.newParentId, payload.sectionId)) throw new Error(`Validation failed: Cannot move a section into one of its own descendants.`);
                        break;
                    case 'add':
                        if (payload.parentId && !uuidRegex.test(payload.parentId)) {
                            throw new Error(`Validation failed: The provided parentId "${payload.parentId}" is not a valid UUID. You MUST use the stable UUID. Call get_report_slices first.`);
                        }
                        if (payload.parentId && !clonedModel.findSectionById(clonedModel.getState().sections, payload.parentId)) {
                            const availableIds = clonedModel.listSections().map(s => s.id);
                            throw new Error(`Validation failed: Parent section with ID "${payload.parentId}" not found for add. Available IDs are: [${availableIds.join(', ')}]`);
                        }
                        break;
                }
            }

            // Stage 2: Apply all operations to the cloned model, checking results.
            for (const op of args.operations) {
                const payload = op; // Use the operation object directly as the payload
                let result: any;
                switch (op.type) {
                    case 'update':
                        if (payload.title !== undefined) {
                            if (!clonedModel.renameSection(payload.id, payload.title)) throw new Error(`Operation failed: Could not rename section ${payload.id}.`);
                        }
                        if (payload.bodyMd !== undefined) {
                            if (!clonedModel.setSectionBody(payload.id, payload.bodyMd)) throw new Error(`Operation failed: Could not set body for section ${payload.id}.`);
                        }
                        if (payload.images !== undefined) {
                            // Handle images updates by directly modifying the section in the cloned model
                            const sections = clonedModel.getState().sections;
                            const findAndUpdateSection = (sectionList: Section[], sectionId: string): boolean => {
                                for (const section of sectionList) {
                                    if (section.id === sectionId) {
                                        section.images = payload.images;
                                        return true;
                                    }
                                    if (section.children && findAndUpdateSection(section.children, sectionId)) {
                                        return true;
                                    }
                                }
                                return false;
                            };
                            
                            if (!findAndUpdateSection(sections, payload.id)) {
                                throw new Error(`Operation failed: Could not find section ${payload.id} to update images.`);
                            }
                        }
                        break;
                    case 'add':
                        const newSectionId = clonedModel.addSection(payload.parentId, { title: payload.title, bodyMd: payload.bodyMd }, payload.position);
                        if (!newSectionId) throw new Error(`Operation failed: Could not add section under parent ${payload.parentId}.`);
                        // Map temporary ID provided by AI to the real new ID
                        if (payload.tempId) {
                            tempIdMap.set(payload.tempId, newSectionId);
                        }
                        break;
                    case 'delete':
                        if (!clonedModel.deleteSection(payload.id)) throw new Error(`Operation failed: Could not delete section ${payload.id}.`);
                        break;
                    case 'move':
                        const sectionId = tempIdMap.get(payload.sectionId) || payload.sectionId;
                        const newParentId = payload.newParentId ? (tempIdMap.get(payload.newParentId) || payload.newParentId) : null;
                        if (!clonedModel.moveSection(sectionId, newParentId, payload.position)) throw new Error(`Operation failed: Could not move section ${sectionId}.`);
                        break;
                }
            }

            // After all structural changes, renumber the sections on the clone.
            clonedModel.autoNumberSections();

            // Stage 3: Commit. If all operations succeeded, commit the state of the clone back to the original model.
            this.model.setState(clonedModel.getState().sections);
            
            return { success: true, data: { message: `Successfully executed ${args.operations.length} operations.` } };

        } catch (error: any) {
            // On any error, the clone is discarded and the original model is untouched.
            console.error('[Tool Error] Batch update failed during transaction:', error);
            return { success: false, error: error.message };
        }
    }

    // --- New Image-Related Tools ---
    async getImageMap(): Promise<ToolResult> {
        const model = this.model;
        const sections = model.getState().sections;
        
        // Build sequential image map using same logic as ReportEditor
        const imageMap = new Map<number, { sectionId: string, imageIndex: number, actualImageNumber: number }>();
        let globalImageCounter = 1;
        
        const traverseAllSections = (sectionList: Section[]) => {
            for (const section of sectionList) {
                if (section.images && section.images.length > 0) {
                    for (let i = 0; i < section.images.length; i++) {
                        imageMap.set(globalImageCounter, {
                            sectionId: section.id,
                            imageIndex: i,
                            actualImageNumber: section.images[i].number
                        });
                        globalImageCounter++;
                    }
                }
                if (section.children && section.children.length > 0) {
                    traverseAllSections(section.children);
                }
            }
        };
        
        traverseAllSections(sections);
        
        // Convert Map to object for return
        const imageMapObject: Record<number, { sectionId: string, imageIndex: number, actualImageNumber: number }> = {};
        imageMap.forEach((value, key) => {
            imageMapObject[key] = value;
        });
        
        return { 
            success: true, 
            data: { 
                imageMap: imageMapObject,
                totalImages: globalImageCounter - 1
            }
        };
    }

    async swapPhotos(imageNumber1: number, imageNumber2: number): Promise<ToolResult> {
        if (imageNumber1 === imageNumber2) {
            return { success: false, error: 'Cannot swap an image with itself.' };
        }

        // Get the current image map
        const imageMapResult = await this.getImageMap();
        if (!imageMapResult.success) {
            return { success: false, error: 'Failed to get image map.' };
        }

        const imageMap = imageMapResult.data.imageMap;
        
        // Find the two images
        const image1Info = imageMap[imageNumber1];
        const image2Info = imageMap[imageNumber2];
        
        if (!image1Info) {
            return { success: false, error: `Image ${imageNumber1} not found in the report.` };
        }
        
        if (!image2Info) {
            return { success: false, error: `Image ${imageNumber2} not found in the report.` };
        }

        const model = this.model;
        const sections = model.getState().sections;
        
        // Helper function to find and update sections
        const findAndGetSection = (sectionList: Section[], sectionId: string): Section | null => {
            for (const section of sectionList) {
                if (section.id === sectionId) {
                    return section;
                }
                if (section.children) {
                    const found = findAndGetSection(section.children, sectionId);
                    if (found) return found;
                }
            }
            return null;
        };
        
        const section1 = findAndGetSection(sections, image1Info.sectionId);
        const section2 = findAndGetSection(sections, image2Info.sectionId);
        
        if (!section1 || !section2) {
            return { success: false, error: 'Could not find one or both sections containing the images.' };
        }

        if (!section1.images || !section2.images) {
            return { success: false, error: 'One or both sections do not have images.' };
        }

        // Store the images and text content to swap
        const image1 = section1.images[image1Info.imageIndex];
        const image2 = section2.images[image2Info.imageIndex];
        const text1 = section1.bodyMd ? [...section1.bodyMd] : [];
        const text2 = section2.bodyMd ? [...section2.bodyMd] : [];
        
        // Create a deep copy of the current sections to work with (fast, direct approach)
        const allSections = JSON.parse(JSON.stringify(sections));
        
        // Helper function to find sections in the copied structure
        const findSectionInCopy = (sectionList: Section[], sectionId: string): Section | null => {
            for (const section of sectionList) {
                if (section.id === sectionId) {
                    return section;
                }
                if (section.children) {
                    const found = findSectionInCopy(section.children, sectionId);
                    if (found) return found;
                }
            }
            return null;
        };
        
        // Find the sections in our copy
        const section1Copy = findSectionInCopy(allSections, image1Info.sectionId);
        const section2Copy = findSectionInCopy(allSections, image2Info.sectionId);
        
        if (!section1Copy || !section2Copy) {
            return { success: false, error: 'Could not find sections in copied structure.' };
        }

        // Perform the swap on the copies (direct manipulation - faster for single swaps)
        // Swap text content
        section1Copy.bodyMd = text2;
        section2Copy.bodyMd = text1;
        
        // Swap images
        if (section1Copy.images && section2Copy.images) {
            section1Copy.images[image1Info.imageIndex] = image2;
            section2Copy.images[image2Info.imageIndex] = image1;
        }
        
        // Update the model state with our modified sections (single atomic operation)
        model.setState(allSections);
        
        return { 
            success: true, 
            data: `Successfully swapped Image ${imageNumber1} (in section ${section1.number || section1Copy.number}) with Image ${imageNumber2} (in section ${section2.number || section2Copy.number}). Both text content and images have been exchanged.`
        };
    }

  // New helper to identify tools that modify the report state
  isActionTool(toolName: string): boolean {
    const actionTools = ['update_section', 'add_section', 'move_section', 'delete_section', 'batch_update_sections', 'renumber_sections', 'swap_photos'];
    return actionTools.includes(toolName);
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
            {
                type: 'function' as const,
                function: {
                    name: 'get_image_map',
                    description: 'Get a mapping of sequential dummy image numbers (1, 2, 3...) to their actual locations in the report. Use this to understand which images the user is referring to by their displayed numbers.',
                    parameters: this.getImageMapSchema,
                    handler: (args: any) => this.getImageMap(),
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
                    description: 'Update the title, body, or images of a specific section.',
                    parameters: this.updateSchema,
                    handler: (args: any) => this.update(args.id, args.title, args.bodyMd, args.images),
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
                    name: 'batch_update_sections',
                    description: "Apply a list of updates, additions, deletions, or moves to sections in a single atomic operation. Use this for large-scale changes like reformatting the entire report or modifying multiple sections at once.",
                    parameters: {
                        type: "object",
                        properties: {
                            operations: {
                                type: "array",
                                description: "An array of operation objects to perform. Each object should have a 'type' and other properties corresponding to the arguments of the single-action tools (e.g., 'id', 'title' for an 'update').",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: {
                                            type: "string",
                                            enum: ["update", "add", "delete", "move"],
                                            description: "The type of operation to perform."
                                        },
                                        // Flattened properties from other tools
                                        id: { type: 'string', description: 'The unique ID of the section to update or delete. IMPORTANT: This must be a stable UUID, not a display number like "1.1". Call get_report_slices to find the UUID if you only have the display number.' },
                                        title: { type: 'string', description: 'The new title for the section.' },
                                        bodyMd: { type: 'array', items: { type: 'string' }, description: 'The new body content for the section.' },
                                        images: { 
                                            type: 'array', 
                                            items: { 
                                                type: 'object',
                                                properties: {
                                                    number: { type: 'number', description: 'The image number reference.' },
                                                    group: { type: 'array', items: { type: 'string' }, description: 'Optional list of image group labels.' }
                                                },
                                                required: ['number']
                                            },
                                            description: 'The images array for the section.' 
                                        },
                                        parentId: { type: ['string', 'null'], description: 'The ID of the parent section for an add operation. IMPORTANT: This must be a stable UUID. Call get_report_slices to find the UUID.' },
                                        position: { type: 'number', description: 'The 0-based index for an add or move operation.' },
                                        sectionId: { type: 'string', description: 'The ID of the section to move. IMPORTANT: This must be a stable UUID, not a display number. Call get_report_slices to find the UUID.' },
                                        newParentId: { type: ['string', 'null'], description: 'The ID of the new parent for a move operation. IMPORTANT: This must be a stable UUID. Call get_report_slices to find the UUID.' },
                                        tempId: { type: 'string', description: 'A temporary client-side ID for a newly added section, used to refer to it in subsequent operations within the same batch.' }
                                    },
                                    required: ["type"]
                                }
                            }
                        },
                        required: ["operations"]
                    },
                    handler: (args: any) => this.batch_update_sections(args)
                }
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
            {
                type: 'function' as const,
                function: {
                    name: 'swap_photos',
                    description: 'Swap two images (and their associated text content) between sections. Use the sequential dummy numbers shown in the frontend (Image 1, Image 2, etc.). This tool handles finding the correct sections and performing both text and image swaps atomically.',
                    parameters: this.swapPhotosSchema,
                    handler: (args: any) => this.swapPhotos(args.imageNumber1, args.imageNumber2),
                },
            },
        ];
    }
}
