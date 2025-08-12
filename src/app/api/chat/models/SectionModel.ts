import { v4 as uuidv4 } from 'uuid';
import { Section, SectionSummary, SectionEditState } from '../types/section';

export class SectionModel {
  private state: SectionEditState;

  constructor(initialSections: Section[] = []) {
    this.state = {
      sections: initialSections,
      version: 1,
      lastModified: new Date().toISOString()
    };
  }

  private updateState(sections: Section[]) {
    this.state = {
      sections,
      version: this.state.version + 1,
      lastModified: new Date().toISOString()
    };
  }

  private findSectionById(sections: Section[], id: string): Section | null {
    for (const section of sections) {
      if (section.id === id) return section;
      const found = this.findSectionById(section.children, id);
      if (found) return found;
    }
    return null;
  }


  private getPath(sections: Section[], id: string, path: string[] = []): string[] | null {
    for (const section of sections) {
      const currentPath = [...path, section.title];
      if (section.id === id) return currentPath;
      const found = this.getPath(section.children, id, currentPath);
      if (found) return found;
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
        const path = [...parentPath, section.title];
        summaries.push({
          id: section.id,
          number: section.number,
          title: section.title,
          path,
          previewText: section.bodyMd.slice(0, 200)
        });
        processSections(section.children, path);
      }
    };

    processSections(this.state.sections);
    return summaries;
  }

  renameSection(sectionId: string, newTitle: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;

    section.title = newTitle;
    this.updateState([...this.state.sections]);
    return true;
  }

  setSectionBody(sectionId: string, bodyMd: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;

    section.bodyMd = this.validateImageRefs(bodyMd);
    this.updateState([...this.state.sections]);
    return true;
  }

  insertSection(afterId: string, title: string, bodyMd: string = ''): string | null {
    const newSection: Section = {
      id: uuidv4(),
      number: '', // Will be set during renumbering
      title,
      bodyMd: this.validateImageRefs(bodyMd),
      children: []
    };

    const insertIntoChildren = (sections: Section[], targetId: string): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          sections.splice(i + 1, 0, newSection);
          return true;
        }
        if (insertIntoChildren(sections[i].children, targetId)) return true;
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
        if (deleteFromChildren(sections[i].children, targetId)) return true;
      }
      return false;
    };

    if (deleteFromChildren(this.state.sections, sectionId)) {
      this.updateState([...this.state.sections]);
      return true;
    }
    return false;
  }

  moveSection(sectionId: string, newParentId: string, position?: number): boolean {
    let sectionToMove: Section | null = null;
    
    // First find and remove the section
    const removeSection = (sections: Section[], targetId: string): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          sectionToMove = sections.splice(i, 1)[0];
          return true;
        }
        if (removeSection(sections[i].children, targetId)) return true;
      }
      return false;
    };

    // Then insert it in the new location
    const insertSection = (sections: Section[], targetId: string): boolean => {
      if (!sectionToMove) return false;

      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === targetId) {
          const insertPos = typeof position === 'number' ? 
            Math.min(position, sections[i].children.length) : 
            sections[i].children.length;
          sections[i].children.splice(insertPos, 0, sectionToMove);
          return true;
        }
        if (insertSection(sections[i].children, targetId)) return true;
      }
      return false;
    };

    if (removeSection(this.state.sections, sectionId) && 
        insertSection(this.state.sections, newParentId)) {
      this.updateState([...this.state.sections]);
      return true;
    }
    return false;
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

    try {
      const regex = new RegExp(find, flags);
      section.bodyMd = section.bodyMd.replace(regex, replace);
      this.updateState([...this.state.sections]);
      return true;
    } catch (e) {
      return false;
    }
  }

  insertImageRef(sectionId: string, imageNumber: number, group?: string): boolean {
    const section = this.findSectionById(this.state.sections, sectionId);
    if (!section) return false;

    const imageRef = group ? 
      `[IMAGE:${imageNumber}:${group}]` : 
      `[IMAGE:${imageNumber}]`;
    
    section.bodyMd += `\n${imageRef}`;
    this.updateState([...this.state.sections]);
    return true;
  }

  // Helper methods for rendering and parsing
  toMarkdown(): string {
    const renderSection = (section: Section): string => {
      // Start with the section header (no # needed for plain text)
      let md = `${section.number}. ${section.title}\n\n`;
      
      if (section.bodyMd.trim()) {
        md += `${section.bodyMd}\n\n`;
      }
      
      // Render children
      for (const child of section.children) {
        md += renderSection(child);
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
          ? processor.stringify({ type: 'root', children: contentNodes }).trim()
          : '',
        children: []
      };

      // Handle section nesting
      if (heading.depth > lastLevel) {
        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(newSection);
        } else {
          sections.push(newSection);
        }
        sectionStack.push(newSection);
      } else if (heading.depth === lastLevel) {
        sectionStack.pop(); // Remove previous section at this level
        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].children.push(newSection);
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
          sectionStack[sectionStack.length - 1].children.push(newSection);
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
}
