import { v4 as uuidv4 } from 'uuid';
import { Section, SectionSummary, SectionEditState } from './types/section';
import { z } from 'zod';
import { ReportStructureStrategy } from '../report_strucutres/reportStrategies';
import { ObservationReportStrategy } from '../report_strucutres/strategies/ObservationReportStrategy'; // Assuming in same folder

//we are using the strategy pattern to allow for different report structures, maybe we want to use inheritance or factory methods instead- think about later

// Add schema
const SectionSchema = z.object({
  title: z.string(),
  bodyMd: z.string().array(),
  children: z.lazy(() => SectionSchema.array())
});

export class SectionModel {
  protected strategy: ReportStructureStrategy;
  private state: SectionEditState;

  constructor(initialSections: Section[] = [], strategy?: ReportStructureStrategy) {
    this.strategy = strategy || new ObservationReportStrategy();
    // Ensure incoming sections are deeply copied and are plain objects
    const sectionsCopy = JSON.parse(JSON.stringify(initialSections));
    this.state = { sections: sectionsCopy, version: 1, lastModified: new Date().toISOString() };
  }

  private updateState(sections: Section[]) {
    // Always ensure the state is composed of plain, serializable objects
    const sectionsCopy = JSON.parse(JSON.stringify(sections));
    this.state = {
      sections: sectionsCopy,
      version: this.state.version + 1,
      lastModified: new Date().toISOString()
    };
  }

  public setState(sections: Section[]): void {
    this.updateState(sections);
  }

  public findSectionById(sections: Section[], id: string): Section | null {
    for (const section of sections) {
      if (section.id === id) return section;
      if (section.children) {
        const found = this.findSectionById(section.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  public isDescendant(potentialChildId: string, potentialParentId: string): boolean {
    const parent = this.findSectionById(this.state.sections, potentialParentId);
    if (!parent || !parent.children) {
        return false;
    }
    return !!this.findSectionById(parent.children, potentialChildId);
  }


  private getPath(sections: Section[], id: string, path: string[] = []): string[] | null {
    for (const section of sections) {
      const currentPath = [...path, section.title || ''];
      if (section.id === id) return currentPath;
      if (section.children) {
        const found = this.getPath(section.children, id, currentPath);
        if (found) return found;
      }
    }
    return null;
  }

  private validateImageRefs(bodyMd: string): string {
    // Validate and fix [IMAGE:x:GROUP] references
    return bodyMd.replace(/\[IMAGE:(\d+)(?::([A-Z]+))?\]/g, (match, num, group) => {
      const imageNum = parseInt(num, 10);
      if (isNaN(imageNum)) return '[IMAGE:1]'; // Default to first image if invalid
      return group ? `[IMAGE:${imageNum}:${group}]` : `[IMAGE:${imageNum}]`;
    });
  }

  // Tool implementations
  listSections(): SectionSummary[] {
    const summaries: SectionSummary[] = [];
    
    const processSections = (sections: Section[], parentPath: string[] = []) => {
      for (const section of sections) {
        const path = [...parentPath, section.title || ''];
        summaries.push({
          id: section.id,
          number: section.number,
          title: section.title || '',
          path,
          previewText: Array.isArray(section.bodyMd) && section.bodyMd.length > 0 ? section.bodyMd[0].slice(0, 200) : ''
        });
        if (section.children) {
          processSections(section.children, path);
        }
      }
    };

    processSections(this.state.sections);
    return summaries;
  }

  findSectionSummary(id: string): SectionSummary | null {
    const sections = this.listSections();
    return sections.find(s => s.id === id) || null;
  }

  renameSection(sectionId: string, newTitle: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;

    section.title = newTitle;
    this.updateState([...this.state.sections]);
    return true;
  }

  setSectionBody(sectionId: string, bodyMd: string[]): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;

    section.bodyMd = bodyMd.map(line => this.validateImageRefs(line));
    this.updateState([...this.state.sections]);
    return true;
  }

  addSection(parentId: string | null, newSectionData: Partial<Section>, position?: number): string | null {
    const newSection: Section = {
      id: uuidv4(),
      number: '', // Will be set during renumbering
      title: newSectionData.title || 'Untitled Section',
      bodyMd: (newSectionData.bodyMd || []).map(line => this.validateImageRefs(line)),
      children: [],
      images: []
    };

    // Handle root-level insertion
    if (parentId === null) {
      const insertPos = typeof position === 'number' ? Math.min(position, this.state.sections.length) : this.state.sections.length;
      this.state.sections.splice(insertPos, 0, newSection);
      this.updateState([...this.state.sections]);
      return newSection.id;
    }

    // Handle insertion into a child
    const parent = this.findSectionById(this.state.sections, parentId);
    if (parent) {
      if (!parent.children) parent.children = [];
      const insertPos = typeof position === 'number' ? Math.min(position, parent.children.length) : parent.children.length;
      parent.children.splice(insertPos, 0, newSection);
      this.updateState([...this.state.sections]);
      return newSection.id;
    }

    return null;
  }

  insertSection(afterId: string, title: string, bodyMd: string[] = []): string | null {
    const newSection: Section = {
      id: uuidv4(),
      number: '', // Will be set during renumbering
      title,
      bodyMd: bodyMd.map(line => this.validateImageRefs(line)),
      children: [],
      images: []
    };

    const insertIntoChildren = (sections: Section[], targetId: string): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          sections.splice(i + 1, 0, newSection);
          return true;
        }
        if (sections[i].children) {
          if (insertIntoChildren(sections[i].children!, targetId)) return true;
        }
      }
      return false;
    };

    if (insertIntoChildren(this.state.sections, afterId)) {
      this.updateState([...this.state.sections]);
      return newSection.id;
    }
    return null;
  }

  deleteSection(sectionId: string): boolean {
    const deleteFromChildren = (sections: Section[], targetId: string): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          sections.splice(i, 1);
          return true;
        }
        if (sections[i].children) {
          if (deleteFromChildren(sections[i].children!, targetId)) return true;
        }
      }
      return false;
    };

    if (deleteFromChildren(this.state.sections, sectionId)) {
      this.updateState([...this.state.sections]);
      return true;
    }
    return false;
  }

  moveSection(sectionId: string, newParentId: string | null, position: number): boolean {
    let sectionToMove: Section | null = null;
    
    // First find and remove the section
    const removeSection = (sections: Section[], targetId: string): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          sectionToMove = sections.splice(i, 1)[0];
          return true;
        }
        if (sections[i].children) {
          if (removeSection(sections[i].children!, targetId)) return true;
        }
      }
      return false;
    };

    // Then insert it in the new location
    const insertIntoParent = (targetParentId: string | null, sections: Section[]): boolean => {
        if (!sectionToMove) return false;

        if (targetParentId === null) {
            const insertPos = Math.min(position, sections.length);
            sections.splice(insertPos, 0, sectionToMove);
            return true;
        }

        const parent = this.findSectionById(sections, targetParentId);
        if (parent) {
            if (!parent.children) parent.children = [];
            const insertPos = Math.min(position, parent.children.length);
            parent.children.splice(insertPos, 0, sectionToMove);
            return true;
        }
        return false;
    };


    if (removeSection(this.state.sections, sectionId)) {
        if(insertIntoParent(newParentId, this.state.sections)) {
            this.updateState([...this.state.sections]);
            return true;
        }
    }
    return false;
  }

  transformAllSections(transformer: (section: Section) => Section): void {
    const transform = (sections: Section[]): Section[] => {
      return sections.map(section => {
        const transformedSection = transformer({ ...section });
        if (transformedSection.children) {
          transformedSection.children = transform(transformedSection.children);
        }
        return transformedSection;
      });
    };
    const newSections = transform(this.state.sections);
    this.updateState(newSections);
  }

  findSections(query: string): SectionSummary[] {
    const normalizedQuery = query.toLowerCase();
    return this.listSections().filter(summary => 
      summary.title.toLowerCase().includes(normalizedQuery) ||
      summary.previewText.toLowerCase().includes(normalizedQuery)
    );
  }

  replaceText(sectionId: string, find: string, replace: string, flags?: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;
    if (!section.bodyMd) return false; // Can't replace text if there's no body

    try {
      const regex = new RegExp(find, flags);
      section.bodyMd = section.bodyMd.map(line => line.replace(regex, replace));
      this.updateState([...this.state.sections]);
      return true;
    } catch (e) {
      return false;
    }
  }

  insertImageRef(sectionId: string, imageNumber: number, group?: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;
    if (!section.bodyMd) section.bodyMd = []; // Ensure bodyMd exists

    const imageRef = group ? 
      `[IMAGE:${imageNumber}:${group}]` : 
      `[IMAGE:${imageNumber}]`;
    
    section.bodyMd.push(imageRef);
    this.updateState([...this.state.sections]);
    return true;
  }

  // Helper methods for rendering and parsing
  toMarkdown(): string {
    const renderSection = (section: Section): string => {
      // Start with the section header (no # needed for plain text)
      let md = `${section.number}. ${section.title || ''}\n\n`;
      
      if (section.bodyMd && section.bodyMd.length > 0) {
        md += `${section.bodyMd.join('\n\n')}\n\n`;
      }
      
      // Render children
      if (section.children) {
        for (const child of section.children) {
          md += renderSection(child);
        }
      }
      
      return md;
    };

    return this.state.sections.map(section => renderSection(section)).join('');
  }

  private static convertPlainTextToMarkdown(text: string): string {
    // Split into lines and process
    const lines = text.split('\n');
    let inCodeBlock = false;
    
    return lines.map(line => {
      // Don't modify content inside code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) return line;

      // Convert numbered sections to markdown headings
      const sectionMatch = line.match(/^(\d+(?:\.\d+)*)\.\s+(.*)/);
      if (sectionMatch) {
        const [, numbers, title] = sectionMatch;
        const depth = numbers.split('.').length;
        return `${'#'.repeat(depth)} ${numbers}. ${title}`;
      }

      return line;
    }).join('\n');
  }

  static async fromMarkdown(markdown: string): Promise<Section[]> {
    const { unified } = await import('unified');
    const { default: remarkParse } = await import('remark-parse');
    const { default: remarkStringify } = await import('remark-stringify');
    const { visit } = await import('unist-util-visit');
    const { v4: uuidv4 } = await import('uuid');

    // Convert plain text format to markdown if needed
    const hasMarkdownHeadings = markdown.includes('\n#');
    const processedMarkdown = hasMarkdownHeadings ? 
      markdown : 
      this.convertPlainTextToMarkdown(markdown);

    const processor = unified()
      .use(remarkParse)
      .use(remarkStringify);
    
    const ast = processor.parse(processedMarkdown);

    // First pass: Find all headings and their positions
    const headingPositions: Array<{
      index: number,
      depth: number,
      title: string,
      number: string,
      id: string
    }> = [];

    ast.children.forEach((node: any, index: number) => {
      if (node.type === 'heading') {
        const titleNode = node.children[0];
        const title = titleNode.value;
        const match = title.match(/^(\d+(?:\.\d+)*)\.\s*(.*)/);
        const number = match ? match[1] : '';
        const cleanTitle = match ? match[2] : title;

        headingPositions.push({
          index,
          depth: node.depth,
          title: cleanTitle,
          number,
          id: uuidv4()
        });
      }
    });

    // Second pass: Create sections with content between headings
    const sections: Section[] = [];
    let sectionStack: Section[] = [];
    let lastLevel = 0;

    for (let i = 0; i < headingPositions.length; i++) {
      const heading = headingPositions[i];
      const nextHeading = headingPositions[i + 1];
      
      // Get content between this heading and the next (or end)
      const contentNodes = ast.children.slice(
        heading.index + 1, // Skip the heading itself
        nextHeading ? nextHeading.index : undefined
      );

      // Create section with its content
      const newSection: Section = {
        id: heading.id,
        number: heading.number,
        title: heading.title,
        bodyMd: contentNodes.length > 0 
          ? processor.stringify({ type: 'root', children: contentNodes }).trim().split('\n')
          : [],
        children: [],
        images: []
      };

      // Handle section nesting
      if (heading.depth > lastLevel) {
        if (sectionStack.length > 0) {
          const parent = sectionStack[sectionStack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(newSection);
        } else {
          sections.push(newSection);
        }
        sectionStack.push(newSection);
      } else if (heading.depth === lastLevel) {
        sectionStack.pop(); // Remove previous section at this level
        if (sectionStack.length > 0) {
          const parent = sectionStack[sectionStack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(newSection);
        } else {
          sections.push(newSection);
        }
        sectionStack.push(newSection);
      } else {
        // Going up levels
        while (sectionStack.length > heading.depth - 1) {
          sectionStack.pop();
        }
        if (sectionStack.length > 0) {
          const parent = sectionStack[sectionStack.length - 1];
          if (!parent.children) parent.children = [];
          parent.children.push(newSection);
        } else {
          sections.push(newSection);
        }
        sectionStack.push(newSection);
      }

      lastLevel = heading.depth;
    }

    return sections;
  }

  getState(): SectionEditState {
    return { ...this.state };
  }

  toJSON(): any {
    return {
      sections: this.state.sections.map(sec => this.sectionToJSON(sec))
    };
  }

  private sectionToJSON(sec: Section): any {
    return {
      title: sec.title,
      bodyMd: sec.bodyMd,
      images: sec.images,
      children: sec.children ? sec.children.map(child => this.sectionToJSON(child)) : undefined
    };
  }

  static fromJSON(json: any, strategy?: ReportStructureStrategy): SectionModel {
    const effectiveStrategy = strategy ?? new ObservationReportStrategy();
    const SectionSchema = effectiveStrategy.getSchema();
    let input = json;
    // In fromJSON, comment out the warn

    if (Array.isArray(json)) {
      console.log('Detected bare array in fromJSON - wrapping to { sections: json }');
      input = { sections: json };
    }

    // console.warn('Received bare array - wrapping as { sections }');
    // input = { sections: json };
    const parsed = z.object({ sections: SectionSchema.array() }).safeParse(input);

    if (parsed.success) {
      const mappedSections = parsed.data.sections.map(sec => this.mapSectionDefaults(sec));
      const model = new SectionModel(mappedSections, effectiveStrategy);
      model.autoNumberSections();
      return model;
    } else {
      throw new Error('Invalid JSON: ' + (parsed.error ? parsed.error.message : 'Parse failed'));
    }
  }

  private static mapSectionDefaults(sec: any): Section {
    return {
      id: uuidv4(),
      number: '',
      title: sec.title,
      bodyMd: sec.bodyMd,
      images: sec.images,
      children: sec.children ? sec.children.map((child: any) => this.mapSectionDefaults(child)) : undefined
    } as Section;
  }

  autoNumberSections(): void {
    this.strategy.autoNumber(this.state.sections, '');
  }

  clone(): SectionModel {
    const clonedSections = typeof structuredClone === 'function'
      ? structuredClone(this.state.sections)
      : JSON.parse(JSON.stringify(this.state.sections)); // fallback, loses undefined/Date
    return new SectionModel(clonedSections, this.strategy);
  }
}
